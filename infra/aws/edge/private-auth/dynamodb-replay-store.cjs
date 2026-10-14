'use strict';

const DEFAULT_REGION = 'us-east-1';
const KEY_ATTRIBUTE = 'transaction_key';
const EXPIRES_AT_ATTRIBUTE = 'expires_at';

function loadDynamoDbSdk() {
  try {
    return require('@aws-sdk/client-dynamodb');
  } catch {
    throw new Error('DynamoDB client dependency is unavailable');
  }
}

function isConditionalCheckFailure(error) {
  return Boolean(error) && (
    error.name === 'ConditionalCheckFailedException' ||
    error.Code === 'ConditionalCheckFailedException' ||
    error.code === 'ConditionalCheckFailedException'
  );
}

function validateConfiguration({ tableName, region }) {
  if (typeof tableName !== 'string' || tableName.trim() === '') {
    throw new Error('Replay table name is required');
  }

  if (typeof region !== 'string' || region.trim() === '') {
    throw new Error('Replay table region is required');
  }
}

function validateConsumeInput({ key, ttlSeconds }) {
  if (typeof key !== 'string' || !/^[a-f0-9]{64}$/.test(key)) {
    throw new Error('Invalid replay transaction key');
  }

  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > 3600) {
    throw new Error('Invalid replay transaction TTL');
  }
}

function createDynamoDbReplayStore({
  tableName,
  region = DEFAULT_REGION,
  client,
  sdk,
  now = Date.now
}) {
  validateConfiguration({ tableName, region });

  if (typeof now !== 'function') {
    throw new Error('Replay store clock is required');
  }

  const dynamoDb = sdk || (!client ? loadDynamoDbSdk() : null);
  const resolvedClient = client || new dynamoDb.DynamoDBClient({ region });
  const PutItemCommand = dynamoDb?.PutItemCommand;

  if (!resolvedClient || typeof resolvedClient.send !== 'function') {
    throw new Error('DynamoDB client is required');
  }

  if (typeof PutItemCommand !== 'function') {
    throw new Error('DynamoDB PutItem command is required');
  }

  return Object.freeze({
    async consumeOnce({ key, ttlSeconds }) {
      validateConsumeInput({ key, ttlSeconds });

      const createdAt = Math.floor(now() / 1000);
      const expiresAt = createdAt + ttlSeconds;
      const command = new PutItemCommand({
        TableName: tableName,
        Item: {
          [KEY_ATTRIBUTE]: { S: key },
          [EXPIRES_AT_ATTRIBUTE]: { N: String(expiresAt) },
          created_at: { N: String(createdAt) }
        },
        ConditionExpression: 'attribute_not_exists(#transactionKey)',
        ExpressionAttributeNames: {
          '#transactionKey': KEY_ATTRIBUTE
        }
      });

      try {
        await resolvedClient.send(command);
        return true;
      } catch (error) {
        if (isConditionalCheckFailure(error)) {
          return false;
        }

        throw error;
      }
    }
  });
}

module.exports = {
  DEFAULT_REGION,
  KEY_ATTRIBUTE,
  EXPIRES_AT_ATTRIBUTE,
  createDynamoDbReplayStore,
  isConditionalCheckFailure
};
