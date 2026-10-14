'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  transactionKey,
  consumeOAuthTransaction
} = require('./oauth-replay-guard.cjs');

const state = 'A'.repeat(43);

test('transaction state is stored as a SHA-256 digest', () => {
  const key = transactionKey(state);

  assert.match(key, /^[a-f0-9]{64}$/);
  assert.notEqual(key, state);
  assert.equal(key, transactionKey(state));
});

test('malformed transaction state is rejected', () => {
  assert.throws(
    () => transactionKey('not-valid-state'),
    /Invalid OAuth transaction state/
  );
});

test('first successful transaction claim is accepted', async () => {
  let received;

  const store = {
    async consumeOnce(input) {
      received = input;
      return true;
    }
  };

  assert.equal(await consumeOAuthTransaction(state, store), true);
  assert.equal(received.key, transactionKey(state));
  assert.equal(received.ttlSeconds, 600);
});

test('already-consumed transaction is rejected', async () => {
  const store = {
    async consumeOnce() {
      return false;
    }
  };

  await assert.rejects(
    consumeOAuthTransaction(state, store),
    /OAuth transaction already consumed/
  );
});

test('missing replay store fails closed', async () => {
  await assert.rejects(
    consumeOAuthTransaction(state, null),
    /OAuth replay protection unavailable/
  );
});

test('replay store errors fail closed', async () => {
  const store = {
    async consumeOnce() {
      throw new Error('database unavailable');
    }
  };

  await assert.rejects(
    consumeOAuthTransaction(state, store),
    /OAuth replay protection unavailable/
  );
});
