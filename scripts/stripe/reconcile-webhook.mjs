#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const STRIPE_API_VERSION = '2025-04-30.basil';
export const REQUIRED_EVENTS = Object.freeze([
  'checkout.session.completed',
  'customer.subscription.deleted',
  'customer.subscription.updated',
  'invoice.paid',
]);

export const ENVIRONMENTS = Object.freeze({
  dev: {
    secretId: 'recruiterreply/dev/backend-app-secrets',
    url: 'https://api-dev.recruiterreply.com/api/billing/webhook',
  },
  test: {
    secretId: 'recruiterreply/test/backend-app-secrets',
    url: 'https://api-test.recruiterreply.com/api/billing/webhook',
  },
});

export function parseArgs(args) {
  const result = { apply: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--apply') result.apply = true;
    else if (arg === '--environment') result.environment = args[++index];
    else if (arg === '--endpoint-id') result.endpointId = args[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!ENVIRONMENTS[result.environment]) throw new Error('--environment must be dev or test');
  if (!/^we_[A-Za-z0-9]+$/.test(result.endpointId ?? '')) {
    throw new Error('--endpoint-id must be a Stripe webhook endpoint ID');
  }
  return result;
}

export function readEnvironmentSecret(secretId, execFile = execFileSync) {
  const output = execFile('aws', [
    'secretsmanager', 'get-secret-value', '--secret-id', secretId,
    '--query', 'SecretString', '--output', 'text',
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  return JSON.parse(output);
}

export function validateSecret(secret) {
  const secretKey = secret?.Stripe?.SecretKey;
  const expectedAccountId = secret?.Stripe?.ExpectedAccountId;
  if (typeof secretKey !== 'string' || !secretKey.startsWith('sk_test_')) {
    throw new Error('The selected environment does not contain a Stripe test-mode secret key');
  }
  if (typeof expectedAccountId !== 'string' || !expectedAccountId.startsWith('acct_')) {
    throw new Error('Stripe:ExpectedAccountId is missing from the selected environment secret');
  }
  return { secretKey, expectedAccountId };
}

export function buildUpdateBody(url) {
  const body = new URLSearchParams({ url });
  for (const event of REQUIRED_EVENTS) body.append('enabled_events[]', event);
  return body;
}

function sanitizedEndpoint(endpoint) {
  return {
    id: endpoint.id,
    url: endpoint.url,
    api_version: endpoint.api_version,
    enabled_events: [...(endpoint.enabled_events ?? [])].sort(),
  };
}

async function stripeRequest(path, secretKey, options = {}, fetchImpl = fetch) {
  const response = await fetchImpl(`https://api.stripe.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Stripe-Version': STRIPE_API_VERSION,
      ...(options.headers ?? {}),
    },
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Stripe API request failed (${response.status}): ${payload?.error?.message ?? 'unknown error'}`);
  }
  return payload;
}

export async function reconcile({ environment, endpointId, apply }, dependencies = {}) {
  const config = ENVIRONMENTS[environment];
  const secret = readEnvironmentSecret(config.secretId, dependencies.execFile);
  const { secretKey, expectedAccountId } = validateSecret(secret);
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const account = await stripeRequest('/v1/account', secretKey, {}, fetchImpl);
  if (account.id !== expectedAccountId) {
    throw new Error(`Stripe account mismatch for ${environment}; refusing to continue`);
  }

  const current = await stripeRequest(`/v1/webhook_endpoints/${endpointId}`, secretKey, {}, fetchImpl);
  if (!apply) return { mode: 'check', endpoint: sanitizedEndpoint(current) };

  const updated = await stripeRequest(`/v1/webhook_endpoints/${endpointId}`, secretKey, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: buildUpdateBody(config.url),
  }, fetchImpl);
  return { mode: 'apply', endpoint: sanitizedEndpoint(updated) };
}

async function main() {
  const result = await reconcile(parseArgs(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
