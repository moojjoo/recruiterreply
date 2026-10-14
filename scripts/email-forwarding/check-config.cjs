'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const EXPECTED_ALIASES = Object.freeze([
  'legal@recruiterreply.com',
  'privacy@recruiterreply.com'
]);
const EXPECTED_DESTINATION = 'robert.dannelly@dannellysolutions.com';

function validateForwardingConfig(config) {
  assert.ok(config && typeof config === 'object' && !Array.isArray(config), 'config must be an object');
  assert.equal(config.catchAll, false, 'catch-all forwarding must be disabled');
  assert.ok(Array.isArray(config.aliases), 'aliases must be an array');
  assert.equal(config.aliases.length, 2, 'exactly two aliases are allowed');
  const sources = config.aliases.map((alias) => {
    assert.ok(alias && typeof alias === 'object', 'alias must be an object');
    assert.equal(alias.destination, EXPECTED_DESTINATION, 'unexpected forwarding destination');
    assert.equal(typeof alias.source, 'string', 'source must be a string');
    return alias.source;
  });
  assert.deepEqual(sources.sort(), [...EXPECTED_ALIASES], 'unexpected alias set');
  return true;
}

if (require.main === module) {
  try {
    const filename = process.argv[2];
    if (!filename) throw new Error('usage: node check-config.cjs <provider-export.json>');
    validateForwardingConfig(JSON.parse(fs.readFileSync(filename, 'utf8')));
    process.stdout.write('Forwarding configuration matches Issue #400 requirements.\n');
  } catch (error) {
    process.stderr.write('Forwarding configuration check failed: ' + error.message + '\n');
    process.exitCode = 1;
  }
}

module.exports = { validateForwardingConfig, EXPECTED_ALIASES, EXPECTED_DESTINATION };
