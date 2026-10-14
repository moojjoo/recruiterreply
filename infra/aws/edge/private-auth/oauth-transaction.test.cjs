'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  createTransactionCookie,
  verifyTransactionCookie,
  clearTransactionCookie
} = require('./oauth-transaction.cjs');

const secret = 'test-only-secret-at-least-32-bytes-long';
const now = 1800000000000;

const transaction = {
  verifier: 'test-pkce-verifier',
  state: 'test-state-value',
  nonce: 'test-nonce-value',
  redirectUri: 'https://dev.recruiterreply.com/_auth/callback'
};

test('transaction cookie has secure attributes', () => {
  const cookie = createTransactionCookie(transaction, secret, now);

  assert.match(cookie.header, /^rr_oauth_tx=/);
  assert.match(cookie.header, /; Secure/);
  assert.match(cookie.header, /; HttpOnly/);
  assert.match(cookie.header, /; SameSite=Lax/);
  assert.match(cookie.header, /; Max-Age=300/);
  assert.match(cookie.header, /; Path=\/_auth/);
});

test('valid transaction cookie round-trips', () => {
  const cookie = createTransactionCookie(transaction, secret, now);
  const value = cookie.value;

  assert.deepEqual(
    verifyTransactionCookie(value, secret, now + 1000),
    {
      ...transaction,
      issuedAt: now
    }
  );
});

test('tampered transaction cookie is rejected', () => {
  const cookie = createTransactionCookie(transaction, secret, now);
  const tampered = `${cookie.value.slice(0, -1)}x`;

  assert.throws(
    () => verifyTransactionCookie(tampered, secret, now + 1000),
    /Invalid OAuth transaction/
  );
});

test('expired transaction cookie is rejected', () => {
  const cookie = createTransactionCookie(transaction, secret, now);

  assert.throws(
    () => verifyTransactionCookie(
      cookie.value,
      secret,
      now + 300001
    ),
    /Expired or invalid OAuth transaction/
  );
});

test('weak signing secrets are rejected', () => {
  assert.throws(
    () => createTransactionCookie(transaction, 'short', now),
    /Invalid OAuth transaction configuration/
  );

  assert.throws(
    () => verifyTransactionCookie('invalid', 'short', now),
    /Invalid OAuth transaction/
  );
});

test('transaction cookie can be cleared securely', () => {
  const header = clearTransactionCookie();

  assert.match(header, /^rr_oauth_tx=;/);
  assert.match(header, /; Max-Age=0/);
  assert.match(header, /; Secure/);
  assert.match(header, /; HttpOnly/);
  assert.match(header, /; SameSite=Lax/);
});
