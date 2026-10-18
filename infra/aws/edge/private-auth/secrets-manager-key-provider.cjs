'use strict';

const DEFAULT_REGION = 'us-east-1';
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const MINIMUM_SECRET_BYTES = 32;

function loadSecretsManagerSdk() {
  try {
    return require('@aws-sdk/client-secrets-manager');
  } catch {
    throw new Error('Secrets Manager client dependency is unavailable');
  }
}

function decodeSecret(response) {
  if (typeof response?.SecretString === 'string') {
    return response.SecretString;
  }

  if (response?.SecretBinary instanceof Uint8Array) {
    return Buffer.from(response.SecretBinary).toString('utf8');
  }

  throw new Error('Signing-key secret has no value');
}

function parseSigningKeys(response) {
  let value;
  try {
    value = JSON.parse(decodeSecret(response));
  } catch (error) {
    if (error.message === 'Signing-key secret has no value') throw error;
    throw new Error('Signing-key secret is not valid JSON');
  }

  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    typeof value.sessionSigningKey !== 'string' ||
    Buffer.byteLength(value.sessionSigningKey) < MINIMUM_SECRET_BYTES ||
    typeof value.transactionSigningKey !== 'string' ||
    Buffer.byteLength(value.transactionSigningKey) < MINIMUM_SECRET_BYTES
  ) {
    throw new Error('Signing-key secret is invalid');
  }

  return Object.freeze({
    sessionSigningKey: value.sessionSigningKey,
    transactionSigningKey: value.transactionSigningKey,
    ...(typeof value.apiOriginSigningKey === 'string'
      ? { apiOriginSigningKey: value.apiOriginSigningKey }
      : {})
  });
}

function createSigningKeyProvider({
  secretId,
  region = DEFAULT_REGION,
  cacheTtlMs = DEFAULT_CACHE_TTL_MS,
  client,
  sdk,
  now = Date.now
}) {
  if (typeof secretId !== 'string' || secretId.trim() === '') {
    throw new Error('Signing-key secret ID is required');
  }

  if (typeof region !== 'string' || region.trim() === '') {
    throw new Error('Signing-key secret region is required');
  }

  if (!Number.isInteger(cacheTtlMs) || cacheTtlMs < 1 || cacheTtlMs > 3600000) {
    throw new Error('Signing-key cache TTL is invalid');
  }

  if (typeof now !== 'function') {
    throw new Error('Signing-key provider clock is required');
  }

  const secretsManager = sdk || (!client ? loadSecretsManagerSdk() : null);
  const resolvedClient = client || new secretsManager.SecretsManagerClient({ region });
  const GetSecretValueCommand = secretsManager?.GetSecretValueCommand;

  if (!resolvedClient || typeof resolvedClient.send !== 'function') {
    throw new Error('Secrets Manager client is required');
  }

  if (typeof GetSecretValueCommand !== 'function') {
    throw new Error('Secrets Manager GetSecretValue command is required');
  }

  let cached;
  let expiresAt = 0;
  let pending;

  async function retrieve() {
    const response = await resolvedClient.send(new GetSecretValueCommand({
      SecretId: secretId,
      VersionStage: 'AWSCURRENT'
    }));
    return parseSigningKeys(response);
  }

  return async function getSigningKeys() {
    const currentTime = now();
    if (cached && currentTime < expiresAt) return cached;

    if (!pending) {
      pending = retrieve()
        .then(value => {
          cached = value;
          expiresAt = now() + cacheTtlMs;
          return value;
        })
        .finally(() => {
          pending = undefined;
        });
    }

    return pending;
  };
}

module.exports = {
  DEFAULT_REGION,
  DEFAULT_CACHE_TTL_MS,
  createSigningKeyProvider,
  parseSigningKeys
};
