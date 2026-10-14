'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { createTransactionCookie } = require('./oauth-transaction.cjs');
const { validateOAuthCallback } = require('./oauth-callback.cjs');

const secret = 'test-only-secret-at-least-32-bytes-long';
const now = 1800000000000;

const transaction = {
  verifier: 'test-pkce-verifier',
  state: 'A'.repeat(43),
  nonce: 'test-nonce-value',
  redirectUri: 'https://dev.recruiterreply.com/_auth/callback'
};

function makeCookie() {
  return createTransactionCookie(transaction, secret, now).value;
}

function validate(query, overrides = {}) {
  return validateOAuthCallback({
    query,
    transactionCookie: makeCookie(),
    transactionSecret: secret,
    expectedRedirectUri: transaction.redirectUri,
    now: now + 1000,
    ...overrides
  });
}

test('valid callback returns code and PKCE transaction data', () => {
  assert.deepEqual(
    validate({ code: 'valid.authorization-code', state: transaction.state }),
    {
      code: 'valid.authorization-code',
      verifier: transaction.verifier,
      nonce: transaction.nonce,
      redirectUri: transaction.redirectUri
    }
  );
});

test('mismatched OAuth state is rejected', () => {
  assert.throws(
    () => validate({ code: 'valid-code', state: 'B'.repeat(43) }),
    /OAuth state mismatch/
  );
});

test('missing authorization code is rejected', () => {
  assert.throws(
    () => validate({ state: transaction.state }),
    /Invalid OAuth callback parameters/
  );
});

test('OAuth provider errors are rejected', () => {
  assert.throws(
    () => validate({ error: 'access_denied', state: transaction.state }),
    /OAuth authorization failed/
  );
});

test('redirect URI mismatch is rejected', () => {
  assert.throws(
    () => validate(
      { code: 'valid-code', state: transaction.state },
      { expectedRedirectUri: 'https://test.recruiterreply.com/_auth/callback' }
    ),
    /OAuth redirect URI mismatch/
  );
});

test('expired transaction cookie is rejected', () => {
  assert.throws(
    () => validate(
      { code: 'valid-code', state: transaction.state },
      { now: now + 300001 }
    ),
    /Expired or invalid OAuth transaction/
  );
});

test('malformed authorization code is rejected', () => {
  assert.throws(
    () => validate({ code: 'bad code with spaces', state: transaction.state }),
    /Invalid OAuth callback parameters/
  );
});
