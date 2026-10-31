import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ENVIRONMENTS, REQUIRED_EVENTS, buildUpdateBody, parseArgs, reconcile, validateSecret,
} from './reconcile-webhook.mjs';

test('uses the API host for each sandbox', () => {
  assert.equal(ENVIRONMENTS.dev.url, 'https://api-dev.recruiterreply.com/api/billing/webhook');
  assert.equal(ENVIRONMENTS.test.url, 'https://api-test.recruiterreply.com/api/billing/webhook');
});

test('pins the exact backend event contract', () => {
  assert.deepEqual(REQUIRED_EVENTS, [
    'checkout.session.completed',
    'customer.subscription.deleted',
    'customer.subscription.updated',
    'invoice.paid',
  ]);
  assert.deepEqual(buildUpdateBody(ENVIRONMENTS.dev.url).getAll('enabled_events[]'), REQUIRED_EVENTS);
});

test('requires an environment and endpoint ID', () => {
  assert.deepEqual(parseArgs(['--environment', 'dev', '--endpoint-id', 'we_example']), {
    apply: false, environment: 'dev', endpointId: 'we_example',
  });
  assert.throws(() => parseArgs(['--environment', 'prod', '--endpoint-id', 'we_example']), /dev or test/);
  assert.throws(() => parseArgs(['--environment', 'dev', '--endpoint-id', 'bad']), /endpoint ID/);
});

test('rejects live-mode and incomplete secrets', () => {
  assert.throws(() => validateSecret({ Stripe: { SecretKey: 'sk_live_value', ExpectedAccountId: 'acct_1' } }), /test-mode/);
  assert.throws(() => validateSecret({ Stripe: { SecretKey: 'sk_test_value' } }), /ExpectedAccountId/);
});

test('check mode is read-only and redacts secrets', async () => {
  const requests = [];
  const result = await reconcile({ environment: 'dev', endpointId: 'we_example', apply: false }, {
    execFile: () => JSON.stringify({ Stripe: { SecretKey: 'sk_test_hidden', ExpectedAccountId: 'acct_expected' } }),
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      const body = url.endsWith('/v1/account')
        ? { id: 'acct_expected' }
        : { id: 'we_example', url: ENVIRONMENTS.dev.url, api_version: '2025-04-30.basil', enabled_events: REQUIRED_EVENTS };
      return { ok: true, json: async () => body };
    },
  });
  assert.equal(requests.length, 2);
  assert.equal(result.mode, 'check');
  assert.equal(JSON.stringify(result).includes('sk_test_hidden'), false);
});

test('apply mode sends the exact URL and event allowlist', async () => {
  const requests = [];
  await reconcile({ environment: 'dev', endpointId: 'we_example', apply: true }, {
    execFile: () => JSON.stringify({ Stripe: { SecretKey: 'sk_test_hidden', ExpectedAccountId: 'acct_expected' } }),
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      if (url.endsWith('/v1/account')) return { ok: true, json: async () => ({ id: 'acct_expected' }) };
      return { ok: true, json: async () => ({
        id: 'we_example', url: ENVIRONMENTS.dev.url,
        api_version: '2025-04-30.basil', enabled_events: REQUIRED_EVENTS,
      }) };
    },
  });
  const update = requests.at(-1);
  assert.equal(update.options.method, 'POST');
  assert.equal(update.options.body.get('url'), ENVIRONMENTS.dev.url);
  assert.deepEqual(update.options.body.getAll('enabled_events[]'), REQUIRED_EVENTS);
});
