'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateForwardingConfig } = require('./check-config.cjs');

const valid = () => ({
  catchAll: false,
  aliases: [
    { source: 'privacy@recruiterreply.com', destination: 'robert.dannelly@dannellysolutions.com' },
    { source: 'legal@recruiterreply.com', destination: 'robert.dannelly@dannellysolutions.com' }
  ]
});

test('accepts only the two approved aliases', () => {
  assert.equal(validateForwardingConfig(valid()), true);
});
test('rejects catch-all', () => {
  const config = valid(); config.catchAll = true;
  assert.throws(() => validateForwardingConfig(config), /catch-all/);
});
test('rejects unexpected alias', () => {
  const config = valid(); config.aliases[0].source = 'support@recruiterreply.com';
  assert.throws(() => validateForwardingConfig(config), /alias set/);
});
test('rejects additional alias', () => {
  const config = valid(); config.aliases.push(config.aliases[0]);
  assert.throws(() => validateForwardingConfig(config), /exactly two/);
});
test('rejects changed destination', () => {
  const config = valid(); config.aliases[0].destination = 'someone@example.com';
  assert.throws(() => validateForwardingConfig(config), /destination/);
});
test('rejects missing explicit catch-all setting', () => {
  const config = valid(); delete config.catchAll;
  assert.throws(() => validateForwardingConfig(config), /catch-all/);
});
