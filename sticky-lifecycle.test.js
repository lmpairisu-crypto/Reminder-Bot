const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Load the production ensureSticky implementation with mocked Discord I/O. This
// keeps the tests offline and avoids logging in to Discord or calling Gemini.
const source = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
const start = source.indexOf('async function ensureSticky(channel, rule, refresh = true) {');
const end = source.indexOf('\n// ============================================================\n// SECTION 16 — GEMINI IMAGE CLASSIFICATION', start);
assert.ok(start >= 0 && end > start, 'ensureSticky function should be present');
const ensureStickySource = source.slice(start, end);

function setup({ scan, initial = [] } = {}) {
  const stickies = [...initial];
  const stickyMessages = new Map();
  const stickyLocks = new Map();
  const stickyRefreshRequested = new Set();
  const stickyDisabledChannels = new Set();
  const stickyLastRefreshAt = new Map();
  let sends = 0;
  let id = initial.length;

  const channel = {
    id: 'channel-1', name: 'test-channel', type: 'text',
    isThread: () => false,
    isTextBased: () => true,
    messages: { fetch: async () => ({ size: 0 }) },
    async send() {
      sends++;
      const message = {
        id: `sticky-${++id}`, createdTimestamp: Date.now(), pinned: false,
        embeds: [{ title: '📢 READ REMINDER!' }],
        async delete() { const index = stickies.findIndex(item => item.id === message.id); if (index >= 0) stickies.splice(index, 1); },
        async unpin() { message.pinned = false; },
      };
      stickies.push(message);
      return message;
    },
  };

  const findExistingStickies = scan || (async () => [...stickies]);
  const createStickyEmbed = () => ({ mocked: true });
  const ChannelType = { GuildForum: 'forum' };
  const fn = new Function('ChannelType', 'stickyDisabledChannels', 'stickyLocks', 'stickyRefreshRequested', 'stickyMessages', 'stickyLastRefreshAt', 'findExistingStickies', 'createStickyEmbed', `${ensureStickySource}; return ensureSticky;`)(
    ChannelType, stickyDisabledChannels, stickyLocks, stickyRefreshRequested, stickyMessages, stickyLastRefreshAt, findExistingStickies, createStickyEmbed,
  );
  return { ensureSticky: fn, channel, stickies, stickyDisabledChannels, stickyMessages, get sends() { return sends; } };
}

const rule = { type: 'skin', name: 'SKIN SHOWCASE', description: 'Test rules' };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

test('coalesces concurrent message events into one final sticky', async () => {
  const env = setup({ scan: async () => { await delay(15); return [...env.stickies]; } });
  await Promise.all(Array.from({ length: 20 }, () => env.ensureSticky(env.channel, rule, true)));
  assert.equal(env.stickies.length, 1);
  assert.equal(env.sends, 1, 'concurrent burst should not create a series of sticky messages');
});

test('startup recovery preserves a single existing sticky', async () => {
  const existing = { id: 'existing', createdTimestamp: 1, pinned: false, embeds: [{ title: '📢 READ REMINDER!' }] };
  const env = setup({ initial: [existing] });
  const result = await env.ensureSticky(env.channel, rule, false);
  assert.equal(result.id, 'existing');
  assert.equal(env.sends, 0);
  assert.equal(env.stickies.length, 1);
});

test('failed sticky scan does not delete or send anything', async () => {
  const existing = { id: 'existing', createdTimestamp: 1, pinned: false, embeds: [{ title: '📢 READ REMINDER!' }] };
  const env = setup({ initial: [existing], scan: async () => null });
  const result = await env.ensureSticky(env.channel, rule, true);
  assert.equal(result, null);
  assert.equal(env.sends, 0);
  assert.equal(env.stickies[0].id, 'existing');
});

test('cleanup disabling the channel during scan prevents a late sticky send', async () => {
  let releaseScan;
  const scanGate = new Promise(resolve => { releaseScan = resolve; });
  const env = setup({ scan: async () => { await scanGate; return [...env.stickies]; } });
  const inFlight = env.ensureSticky(env.channel, rule, true);
  await delay(0);
  env.stickyDisabledChannels.add(env.channel.id);
  releaseScan();
  const result = await inFlight;
  assert.equal(result, null);
  assert.equal(env.sends, 0);
  assert.equal(env.stickies.length, 0);
});

test('startup recovery consolidates duplicate existing stickies', async () => {
  const first = { id: 'old-1', createdTimestamp: 2, pinned: false, embeds: [{ title: '📢 READ REMINDER!' }], async delete() { env.stickies.splice(env.stickies.indexOf(first), 1); } };
  const second = { id: 'old-2', createdTimestamp: 1, pinned: false, embeds: [{ title: '📢 READ REMINDER!' }], async delete() { env.stickies.splice(env.stickies.indexOf(second), 1); } };
  const env = setup({ initial: [first, second] });
  await env.ensureSticky(env.channel, rule, false);
  assert.equal(env.stickies.length, 1);
  assert.equal(env.sends, 1);
});

test('a sticky that cannot be deleted is not replaced', async () => {
  const undeletable = { id: 'old-1', createdTimestamp: 1, pinned: false, embeds: [{ title: '📢 READ REMINDER!' },], async delete() { throw new Error('missing permission'); } };
  const env = setup({ initial: [undeletable] });
  const result = await env.ensureSticky(env.channel, rule, true);
  assert.equal(result, null);
  assert.equal(env.sends, 0);
  assert.equal(env.stickies.length, 1);
});


test('live message handler refreshes sticky before moderation processing', () => {
  const handlerStart = source.indexOf('client.on("messageCreate", async (message) => {');
  const handlerEnd = source.indexOf('\nclient.', handlerStart + 10);
  assert.ok(handlerStart >= 0, 'messageCreate handler should exist');
  const handler = source.slice(handlerStart, handlerEnd > handlerStart ? handlerEnd : undefined);
  const refresh = handler.indexOf('await refreshStickyAfterMessage(channel, rule)');
  const moderation = handler.indexOf('await processMessage(message, rule)');
  assert.ok(refresh >= 0, 'every configured-channel message should request a sticky refresh');
  assert.ok(moderation > refresh, 'sticky refresh should be attempted before moderation processing');
  assert.match(source, /findExistingStickies\(channel, refresh \? 100 : 2000\)/, 'live refresh should use a short scan while startup recovery remains deep');
});
