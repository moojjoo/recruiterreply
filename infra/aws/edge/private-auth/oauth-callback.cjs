'use strict';

const { verifyTransactionCookie } = require('./oauth-transaction.cjs');

function validateOAuthCallback({
  query,
  transactionCookie,
  transactionSecret,
  expectedRedirectUri,
  now = Date.now()
}) {
  if (
    !query ||
    typeof query !== 'object' ||
    typeof expectedRedirectUri !== 'string'
  ) {
    throw new Error('Invalid OAuth callback');
  }

  if (query.error) {
    throw new Error('OAuth authorization failed');
  }

  const code = query.code;
  const state = query.state;

  if (
    typeof code !== 'string' ||
    !/^[A-Za-z0-9._~-]{1,2048}$/.test(code) ||
    typeof state !== 'string' ||
    !/^[A-Za-z0-9_-]{43}$/.test(state)
  ) {
    throw new Error('Invalid OAuth callback parameters');
  }

  const transaction = verifyTransactionCookie(
    transactionCookie,
    transactionSecret,
    now
  );

  if (state !== transaction.state) {
    throw new Error('OAuth state mismatch');
  }

  if (
    transaction.redirectUri !== expectedRedirectUri
  ) {
    throw new Error('OAuth redirect URI mismatch');
  }

  return {
    code,
    verifier: transaction.verifier,
    nonce: transaction.nonce,
    redirectUri: transaction.redirectUri
  };
}

module.exports = { validateOAuthCallback };
