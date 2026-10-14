'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  createDynamoDbReplayStore,
  isConditionalCheckFailure
} = require('./dynamodb-replay-store.cjs');

class FakePutItemCommand {
  constructor(input) {
    this.input = input;
  }
}

const sdk = { PutItemCommand: FakePutItemCommand };
const key = 'a'.repeat(64);

test('claims an OAuth transaction using an atomic conditional write', async () => {
  let receivedCommand;
  const client = {
    async send(command) {
      receivedCommand = command;
      return {};
    }
  };
  const store = createDynamoDbReplayStore({
    tableName: 'recruiterreply-dev-oauth-replay',
    region: 'us-east-1',
    client,
    sdk,
    now: () => 1_700_000_000_000
  });

  assert.equal(await store.consumeOnce({ key, ttlSeconds: 600 }), true);
  assert.ok(receivedCommand instanceof FakePutItemCommand);
  assert.deepEqual(receivedCommand.input, {
    TableName: 'recruiterreply-dev-oauth-replay',
    Item: {
      transaction_key: { S: key },
      expires_at: { N: '1700000600' },
      created_at: { N: '1700000000' }
    },
    ConditionExpression: 'attribute_not_exists(#transactionKey)',
    ExpressionAttributeNames: {
      '#transactionKey': 'transaction_key'
    }
  });
});

test('maps DynamoDB conditional failures to a consumed transaction', async () => {
  const client = {
    async send() {
      const error = new Error('condition failed');
      error.name = 'ConditionalCheckFailedException';
      throw error;
    }
  };
  const store = createDynamoDbReplayStore({
    tableName: 'recruiterreply-test-oauth-replay',
    client,
    sdk
  });

  assert.equal(await store.consumeOnce({ key, ttlSeconds: 600 }), false);
});

test('propagates DynamoDB availability failures so callers fail closed', async () => {
  const client = {
    async send() {
      throw new Error('DynamoDB unavailable');
    }
  };
  const store = createDynamoDbReplayStore({
    tableName: 'recruiterreply-test-oauth-replay',
    client,
    sdk
  });

  await assert.rejects(
    store.consumeOnce({ key, ttlSeconds: 600 }),
    /DynamoDB unavailable/
  );
});

test('rejects unsafe configuration and consume inputs', async () => {
  const client = { async send() {} };

  assert.throws(
    () => createDynamoDbReplayStore({ tableName: '', client, sdk }),
    /Replay table name is required/
  );

  const store = createDynamoDbReplayStore({
    tableName: 'recruiterreply-dev-oauth-replay',
    client,
    sdk
  });

  await assert.rejects(
    store.consumeOnce({ key: 'raw-state', ttlSeconds: 600 }),
    /Invalid replay transaction key/
  );
  await assert.rejects(
    store.consumeOnce({ key, ttlSeconds: 0 }),
    /Invalid replay transaction TTL/
  );
});

test('recognizes supported DynamoDB conditional error shapes only', () => {
  assert.equal(isConditionalCheckFailure({ name: 'ConditionalCheckFailedException' }), true);
  assert.equal(isConditionalCheckFailure({ Code: 'ConditionalCheckFailedException' }), true);
  assert.equal(isConditionalCheckFailure({ code: 'ConditionalCheckFailedException' }), true);
  assert.equal(isConditionalCheckFailure(new Error('timeout')), false);
  assert.equal(isConditionalCheckFailure(null), false);
});
