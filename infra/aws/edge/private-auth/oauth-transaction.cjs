'use strict';

const {seal, open} = require('./sealed-cookie.cjs');

const COOKIE_NAME = 'rr_oauth_tx';
const MAX_AGE_SECONDS = 300;

function createTransactionCookie(transaction, secret, now = Date.now()) {
  if (
    typeof secret !== 'string' ||
    Buffer.byteLength(secret) < 32 ||
    !transaction ||
    typeof transaction.verifier !== 'string' ||
    typeof transaction.state !== 'string' ||
    typeof transaction.nonce !== 'string' ||
    typeof transaction.redirectUri !== 'string'
  ) {
    throw new Error('Invalid OAuth transaction configuration');
  }

  const payload = JSON.stringify({
    verifier: transaction.verifier,
    state: transaction.state,
    nonce: transaction.nonce,
    redirectUri: transaction.redirectUri,
    issuedAt: now
  });
  const value = seal(payload, secret, COOKIE_NAME);

  return {
    name: COOKIE_NAME,
    value,
    header: `${COOKIE_NAME}=${value}; Path=/_auth; Max-Age=${MAX_AGE_SECONDS}; Secure; HttpOnly; SameSite=Lax`
  };
}

function verifyTransactionCookie(value, secret, now = Date.now()) {
  if (
    typeof secret !== 'string' ||
    Buffer.byteLength(secret) < 32 ||
    typeof value !== 'string' ||
    value.length > 4096
  ) {
    throw new Error('Invalid OAuth transaction');
  }

  let transaction;
  try {
    transaction = JSON.parse(open(value, secret, COOKIE_NAME));
  } catch {
    throw new Error('Invalid OAuth transaction payload');
  }

  if (
    !Number.isSafeInteger(transaction.issuedAt) ||
    transaction.issuedAt > now ||
    now - transaction.issuedAt > MAX_AGE_SECONDS * 1000 ||
    typeof transaction.verifier !== 'string' ||
    typeof transaction.state !== 'string' ||
    typeof transaction.nonce !== 'string' ||
    typeof transaction.redirectUri !== 'string'
  ) {
    throw new Error('Expired or invalid OAuth transaction');
  }

  return transaction;
}

function clearTransactionCookie() {
  return `${COOKIE_NAME}=; Path=/_auth; Max-Age=0; Secure; HttpOnly; SameSite=Lax`;
}

module.exports = {
  createTransactionCookie,
  verifyTransactionCookie,
  clearTransactionCookie
};
