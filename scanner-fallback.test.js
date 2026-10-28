const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('index.js', 'utf8');

test('OpenAI secondary scanner is configurable and receives the same image URL', () => {
  assert.match(source, /OPENAI_API_KEY = process\.env\.OPENAI_API_KEY/);
  assert.match(source, /async function askOpenAIImage\(imageUrl, channelType\)/);
  assert.match(source, /askOpenAIImage\(attachment\.url, channelType\)/);
});

test('Gemini unknown/quota result triggers OpenAI fallback before final inconclusive result', () => {
  assert.match(source, /if \(result\.status === "unknown" && !result\.serious\)/);
  assert.match(source, /Both scanners inconclusive/);
  assert.match(source, /media retained/);
});

test('Gemini compound retry durations are parsed rather than always retrying after one hour', () => {
  assert.match(source, /const compound = message\.match\(\/retry in/);
  assert.match(source, /geminiCooldownUntil = Date\.now\(\) \+ Math\.min/);
});

test('sticky cache is checked against Discord before refreshing', () => {
  assert.match(source, /channel\.messages\.fetch\(cachedSticky\.id\)/);
  assert.match(source, /Sticky is at the bottom of #\$\{channel\.name\}; moderation scan may start now/);
});
