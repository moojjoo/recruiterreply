'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  createSigningKeyProvider,
  parseSigningKeys
} = require('./secrets-manager-key-provider.cjs');

class FakeGetSecretValueCommand {
  constructor(input) {
    this.input = input;
  }
}

const sdk = { GetSecretValueCommand: FakeGetSecretValueCommand };
const secretValue = JSON.stringify({
  sessionSigningKey: 'session-signing-key-at-least-32-bytes-long',
  transactionSigningKey: 'transaction-signing-key-at-least-32-bytes',
  apiOriginSigningKey: 'api-origin-signing-key-at-least-32-bytes'
});

test('retrieves AWSCURRENT signing keys from an explicit secret ID', async () => {
  let command;
  const client = {
    async send(received) {
      command = received;
      return { SecretString: secretValue };
    }
  };
  const getSigningKeys = createSigningKeyProvider({
    secretId: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:dev-auth',
    region: 'us-east-1',
    client,
    sdk
  });

  const keys = await getSigningKeys();

  assert.ok(command instanceof FakeGetSecretValueCommand);
  assert.deepEqual(command.input, {
    SecretId: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:dev-auth',
    VersionStage: 'AWSCURRENT'
  });
  assert.equal(keys.sessionSigningKey.length >= 32, true);
  assert.equal(keys.transactionSigningKey.length >= 32, true);
  assert.equal(keys.apiOriginSigningKey.length >= 32, true);
  assert.equal(Object.isFrozen(keys), true);
});

test('caches signing keys for warm invocations', async () => {
  let calls = 0;
  let currentTime = 1000;
  const client = {
    async send() {
      calls += 1;
      return { SecretString: secretValue };
    }
  };
  const getSigningKeys = createSigningKeyProvider({
    secretId: 'dev-auth',
    cacheTtlMs: 300000,
    client,
    sdk,
    now: () => currentTime
  });

  const first = await getSigningKeys();
  currentTime += 299999;
  const second = await getSigningKeys();

  assert.strictEqual(first, second);
  assert.equal(calls, 1);
});

test('refreshes signing keys after cache expiry', async () => {
  let calls = 0;
  let currentTime = 1000;
  const client = {
    async send() {
      calls += 1;
      return { SecretString: secretValue };
    }
  };
  const getSigningKeys = createSigningKeyProvider({
    secretId: 'dev-auth',
    cacheTtlMs: 100,
    client,
    sdk,
    now: () => currentTime
  });

  await getSigningKeys();
  currentTime += 100;
  await getSigningKeys();

  assert.equal(calls, 2);
});

test('coalesces concurrent cold-start retrievals', async () => {
  let calls = 0;
  let resolveRequest;
  const client = {
    send() {
      calls += 1;
      return new Promise(resolve => {
        resolveRequest = resolve;
      });
    }
  };
  const getSigningKeys = createSigningKeyProvider({
    secretId: 'dev-auth',
    client,
    sdk
  });

  const first = getSigningKeys();
  const second = getSigningKeys();
  resolveRequest({ SecretString: secretValue });

  assert.strictEqual(await first, await second);
  assert.equal(calls, 1);
});

test('does not cache service failures', async () => {
  let calls = 0;
  const client = {
    async send() {
      calls += 1;
      if (calls === 1) throw new Error('Secrets Manager unavailable');
      return { SecretString: secretValue };
    }
  };
  const getSigningKeys = createSigningKeyProvider({
    secretId: 'dev-auth',
    client,
    sdk
  });

  await assert.rejects(getSigningKeys(), /Secrets Manager unavailable/);
  assert.equal((await getSigningKeys()).sessionSigningKey.length >= 32, true);
  assert.equal(calls, 2);
});

test('rejects missing, malformed, and weak signing-key secrets', () => {
  assert.throws(() => parseSigningKeys({}), /has no value/);
  assert.throws(
    () => parseSigningKeys({ SecretString: 'not-json' }),
    /not valid JSON/
  );
  assert.throws(
    () => parseSigningKeys({
      SecretString: JSON.stringify({
        sessionSigningKey: 'short',
        transactionSigningKey: 'also-short'
      })
    }),
    /is invalid/
  );
});

test('rejects missing configuration before creating a client', () => {
  assert.throws(
    () => createSigningKeyProvider({ secretId: '', client: {}, sdk }),
    /secret ID is required/
  );
});
