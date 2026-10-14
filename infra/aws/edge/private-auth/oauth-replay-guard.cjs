'use strict';

const crypto = require('node:crypto');

function transactionKey(state) {
  if (typeof state !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(state)) {
    throw new Error('Invalid OAuth transaction state');
  }

  return crypto
    .createHash('sha256')
    .update(state)
    .digest('hex');
}

async function consumeOAuthTransaction(state, store) {
  if (!store || typeof store.consumeOnce !== 'function') {
    throw new Error('OAuth replay protection unavailable');
  }

  const key = transactionKey(state);

  let consumed;
  try {
    consumed = await store.consumeOnce({
      key,
      ttlSeconds: 600
    });
  } catch {
    throw new Error('OAuth replay protection unavailable');
  }

  if (consumed !== true) {
    throw new Error('OAuth transaction already consumed');
  }

  return true;
}

module.exports = {
  transactionKey,
  consumeOAuthTransaction
};
