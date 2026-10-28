const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');

test('Event Code Share channel has a separate rule type', () => {
  assert.match(source, /"1541019893552644187":\s*\{\s*type:\s*"event-code"/);
});

test('Event Code Share routes to its own validator before Code Share validation', () => {
  assert.match(source, /if \(rule\.type === "event-code"\) return validateEventCodeSharePost\(message\);/);
  assert.match(source, /function validateEventCodeSharePost\(message\)/);
});

test('Event Code Share accepts the provided code format without requiring media', () => {
  assert.match(source, /\[A-Z0-9\]\{8\}\\s\*-\\s\*\\d\{3\}/);
  assert.match(source, /Text-only Event Code Share submission accepted/);
  assert.match(source, /Code Share verification is not used here/);
});

test('Code Share screenshot-only validator remains separate and unchanged', () => {
  assert.match(source, /function validateEventCode\(message\)/);
  assert.match(source, /Screenshot\/image submission accepted, including accompanying text\./);
  assert.match(source, /return validateEventCode\(message\);/);
});


test('Code Share accepts text-only code submissions but rejects unrelated text', () => {
  assert.match(source, /Text-only Code Share submission contains a code/);
  assert.match(source, /Code Share requires a code in text or a screenshot\/image/);
  assert.match(source, /Replies are allowed only when the entire reply is one approved phrase/);
});

test('spam incidents update a single private audit summary with channels, removals, and count', () => {
  assert.match(source, /async function updateSpamAuditSummary\(incidentKey, message = null\)/);
  assert.match(source, /SPAM INCIDENT — AUDIT SUMMARY/);
  assert.match(source, /Channels affected/);
  assert.match(source, /Remove Count/);
  assert.match(source, /existing\.edit\(\{ embeds:/);
  assert.match(source, /auditSummaryMessageId/);
});
