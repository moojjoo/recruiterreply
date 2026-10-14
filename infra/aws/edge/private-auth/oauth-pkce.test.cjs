'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const crypto = require('node:crypto');

const {
  generatePkce,
  generateOAuthState,
  generateNonce
} = require('./oauth-pkce.cjs');

test('PKCE verifier uses secure base64url encoding', () => {
  const { verifier } = generatePkce();

  assert.match(verifier, /^[A-Za-z0-9_-]{43}$/);
});

test('PKCE challenge matches SHA-256 of verifier', () => {
  const { verifier, challenge, method } = generatePkce();

  const expected = crypto
    .createHash('sha256')
    .update(verifier, 'ascii')
    .digest('base64url');

  assert.equal(challenge, expected);
  assert.equal(method, 'S256');
});

test('PKCE verifiers are unique', () => {
  const verifiers = new Set(
    Array.from({ length: 100 }, () => generatePkce().verifier)
  );

  assert.equal(verifiers.size, 100);
});

test('OAuth state is cryptographically random', () => {
  const first = generateOAuthState();
  const second = generateOAuthState();

  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first, second);
});

test('OAuth nonce is cryptographically random', () => {
  const first = generateNonce();
  const second = generateNonce();

  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first, second);
});
