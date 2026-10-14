'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { validateIdTokenNonce } = require('./oauth-nonce.cjs');

const expectedNonce = 'random-login-nonce-value';

test('matching ID-token nonce is accepted', () => {
  assert.equal(
    validateIdTokenNonce({ nonce: expectedNonce }, expectedNonce),
    true
  );
});

test('incorrect ID-token nonce is rejected', () => {
  assert.throws(
    () => validateIdTokenNonce({ nonce: 'attacker-nonce' }, expectedNonce),
    /ID-token nonce mismatch/
  );
});

test('missing ID-token nonce is rejected', () => {
  assert.throws(
    () => validateIdTokenNonce({}, expectedNonce),
    /ID-token nonce mismatch/
  );
});

test('empty expected nonce is rejected', () => {
  assert.throws(
    () => validateIdTokenNonce({ nonce: '' }, ''),
    /ID-token nonce mismatch/
  );
});

test('missing claims are rejected', () => {
  assert.throws(
    () => validateIdTokenNonce(null, expectedNonce),
    /ID-token nonce mismatch/
  );
});
