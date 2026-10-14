'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {seal, open} = require('./sealed-cookie.cjs');

const secret = 'test-only-high-entropy-cookie-secret-material';

test('AES-GCM sealed cookies round-trip without exposing plaintext', () => {
  const plaintext = JSON.stringify({sub: 'tester@example.com', verifier: 'private-pkce-verifier'});
  const value = seal(plaintext, secret, 'rr_test');
  assert.equal(value.includes('tester@example.com'), false);
  assert.equal(value.includes('private-pkce-verifier'), false);
  assert.equal(open(value, secret, 'rr_test'), plaintext);
});

test('sealed cookies use a fresh IV and reject tampering', () => {
  const first = seal('same value', secret, 'rr_test');
  const second = seal('same value', secret, 'rr_test');
  assert.notEqual(first, second);
  assert.throws(() => open(`${first.slice(0, -1)}x`, secret, 'rr_test'));
});

test('purpose binding prevents a transaction cookie becoming a session cookie', () => {
  const value = seal('payload', secret, 'rr_oauth_tx');
  assert.throws(() => open(value, secret, 'rr_session'));
});
