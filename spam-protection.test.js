const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');

test('spam timeout tiers are 10m at 10, 30m at 15, and 60m at 20', () => {
  assert.match(source, /SPAM_TIMEOUT_LEVELS\s*=\s*\[\s*\{\s*at:\s*10,\s*minutes:\s*10\s*\},\s*\{\s*at:\s*15,\s*minutes:\s*30\s*\},\s*\{\s*at:\s*20,\s*minutes:\s*60\s*\}\s*\]/);
  assert.match(source, /SPAM_COUNTER_CAP\s*=\s*20/);
});

test('spam burst detection key is server-wide and does not include channel ID', () => {
  assert.match(source, /const key = `\$\{message\.guild\.id\}:\$\{message\.author\.id\}`; \/\/ server-wide, not per-channel/);
});

test('message counts and private audit logs deduplicate by guild plus message ID', () => {
  assert.match(source, /const msgKey = `\$\{message\.guild\.id\}:\$\{message\.id\}`/);
  assert.match(source, /const messageKey = `\$\{message\.guild\.id\}:\$\{message\.id\}`/);
});

test('spam incident tracking preserves first channel and first message without replacing Reminder Log embeds', () => {
  assert.match(source, /firstChannelId: message\.channel\?\.id/);
  assert.match(source, /firstMessageId: message\.id/);
  assert.match(source, /await sendReminderLog\(reminderEmbed, message\.author\?\.id\);/);
});

test('Reminder Log keeps the original per-message embed instead of replacing it with a spam summary', () => {
  assert.match(source, /const reminderDescription = `\$\{commonDescription\}\\n\\n\*\*Specific reason:\*\*/);
  assert.match(source, /await sendReminderLog\(reminderEmbed, message\.author\?\.id\);/);
  assert.doesNotMatch(source, /\*\*SPAM VIOLATION SUMMARY\*\*/);
});

test('removal handlers do not call Reminder Log twice for the same message', () => {
  assert.doesNotMatch(source, /await countRemovedViolation\(message, reason\);\s*await logRemovedMessage\(message, reason/);
  assert.doesNotMatch(source, /await countRemovedViolation\(message, spam\.reason\);\s*await logRemovedMessage\(message, spam\.reason/);
});
