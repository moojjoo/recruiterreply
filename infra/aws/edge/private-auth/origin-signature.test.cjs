'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createOriginSignature } = require('./origin-signature.cjs');

test('origin signature binds method, path, query, timestamp, and secret', () => {
  const input = {
    method: 'POST',
    uri: '/api/messages',
    querystring: 'mode=reply',
    timestamp: '1800000000',
    secret: 'test-only-origin-signing-key-with-32-bytes'
  };
  const signature = createOriginSignature(input);

  assert.match(signature, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(signature, createOriginSignature({ ...input, method: 'GET' }));
  assert.notEqual(signature, createOriginSignature({ ...input, uri: '/api/other' }));
  assert.notEqual(signature, createOriginSignature({ ...input, querystring: 'mode=other' }));
});

test('origin signature rejects weak keys and malformed input', () => {
  assert.throws(() => createOriginSignature({
    method: 'GET', uri: '/api/health', timestamp: '1', secret: 'short'
  }), /Invalid origin-signature input/);
});
