'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateForwardingConfig } = require('./check-config.cjs');

const valid = () => ({
  catchAll: true,
  aliases: [
    { source: '*@recruiterreply.com', destination: 'robert.dannelly@dannellysolutions.com' },
    { source: 'privacy@recruiterreply.com', destination: 'robert.dannelly@dannellysolutions.com' },
    { source: 'legal@recruiterreply.com', destination: 'robert.dannelly@dannellysolutions.com' }
  ]
});

test('accepts catch-all with the two optional published aliases', () => {
  assert.equal(validateForwardingConfig(valid()), true);
});
test('rejects disabled catch-all', () => {
  const config = valid(); config.catchAll = false;
  assert.throws(() => validateForwardingConfig(config), /catch-all/);
});
test('rejects unexpected alias', () => {
  const config = valid(); config.aliases[1].source = 'support@recruiterreply.com';
  assert.throws(() => validateForwardingConfig(config), /alias set/);
});
test('rejects additional alias', () => {
  const config = valid(); config.aliases.push(config.aliases[0]);
  assert.throws(() => validateForwardingConfig(config), /only catch-all/);
});
test('rejects changed destination', () => {
  const config = valid(); config.aliases[0].destination = 'someone@example.com';
  assert.throws(() => validateForwardingConfig(config), /destination/);
});
test('rejects missing explicit catch-all setting', () => {
  const config = valid(); delete config.catchAll;
  assert.throws(() => validateForwardingConfig(config), /catch-all/);
});
test('accepts catch-all alone and rejects missing or duplicate catch-all', () => {
  const config = valid(); config.aliases = [config.aliases[0]];
  assert.equal(validateForwardingConfig(config), true);
  config.aliases = valid().aliases.slice(1);
  assert.throws(() => validateForwardingConfig(config), /catch-all alias/);
  config.aliases = [valid().aliases[0], valid().aliases[0]];
  assert.throws(() => validateForwardingConfig(config), /duplicate/);
});
