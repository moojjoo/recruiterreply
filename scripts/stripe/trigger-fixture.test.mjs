import assert from 'node:assert/strict';
import test from 'node:test';

import { ENVIRONMENTS, REQUIRED_EVENTS } from './reconcile-webhook.mjs';
import {
  buildCliEnvironment, findStripeCli, parseArgs, redactId, validateFixture,
} from './trigger-fixture.mjs';

const SECRET = { Stripe: { SecretKey: 'sk_test_hidden', ExpectedAccountId: 'acct_expected' } };

function dependencies(overrides = {}) {
  const calls = { cli: [], removed: [] };
  let eventListRequests = 0;
  return {
    calls,
    values: {
      readSecret: () => JSON.stringify(SECRET),
      findCli: async () => '/stripe',
      mkdtempImpl: async () => '/tmp/isolated-stripe',
      writeFileImpl: async () => {},
      rmImpl: async (path, options) => calls.removed.push({ path, options }),
      now: () => 1_700_000_000_000,
      sleepImpl: async () => {},
      environment: { PATH: '/usr/bin' },
      execFileImpl: async (file, args, options) => calls.cli.push({ file, args, options }),
      fetchImpl: async (url) => {
        let body;
        if (url.endsWith('/v1/account')) body = { id: 'acct_expected' };
        else if (url.includes('/v1/webhook_endpoints/')) body = {
          id: 'we_example', livemode: false, url: ENVIRONMENTS.dev.url,
          api_version: '2025-04-30.basil', enabled_events: REQUIRED_EVENTS,
        };
        else if (url.includes('/v1/events?')) {
          eventListRequests += 1;
          body = eventListRequests === 1 ? { data: [] } : {
            data: [{ id: 'evt_1234567890', type: 'invoice.paid', livemode: false }],
          };
        }
        else body = { id: 'evt_1234567890', type: 'invoice.paid', livemode: false };
        return { ok: true, status: 200, json: async () => body };
      },
      ...overrides,
    },
  };
}

test('validates environment, endpoint, event allowlist, and action combinations', () => {
  assert.deepEqual(parseArgs([
    '--environment', 'dev', '--endpoint-id', 'we_example', '--event', 'invoice.paid', '--trigger',
  ]), {
    action: 'trigger', environment: 'dev', endpointId: 'we_example', eventType: 'invoice.paid',
  });
  assert.throws(() => parseArgs(['--environment', 'prod', '--endpoint-id', 'we_x', '--event', 'invoice.paid']), /dev or test/);
  assert.throws(() => parseArgs(['--environment', 'dev', '--endpoint-id', 'bad', '--event', 'invoice.paid']), /endpoint ID/);
  assert.throws(() => parseArgs(['--environment', 'dev', '--endpoint-id', 'we_x', '--event', 'charge.succeeded']), /must be one of/);
  assert.throws(() => parseArgs(['--environment', 'dev', '--endpoint-id', 'we_x', '--event', 'invoice.paid', '--resend-event', 'evt_x']), /cannot be combined/);
  assert.throws(() => parseArgs(['--environment', 'dev', '--endpoint-id', 'we_x', '--event', 'invoice.paid', '--trigger', '--check']), /exactly one action/);
});

test('isolates the CLI account with a temporary home and environment key', () => {
  const environment = buildCliEnvironment({ PATH: '/usr/bin', STRIPE_API_KEY: 'old' }, 'sk_test_hidden', '/tmp/new-home');
  assert.equal(environment.HOME, '/tmp/new-home');
  assert.equal(environment.STRIPE_API_KEY, 'sk_test_hidden');
  assert.equal(environment.PATH, '/usr/bin');
});

test('discovers the user-local Stripe CLI before PATH entries', async () => {
  const attempted = [];
  const result = await findStripeCli({
    environment: { PATH: '/usr/bin:/bin' },
    home: '/home/example',
    accessImpl: async (candidate) => {
      attempted.push(candidate);
      if (candidate !== '/home/example/.stripe/bin/stripe') throw new Error('missing');
    },
  });
  assert.equal(result, '/home/example/.stripe/bin/stripe');
  assert.deepEqual(attempted, ['/home/example/.stripe/bin/stripe']);
});

test('check mode validates the account and destination without invoking a fixture', async () => {
  const fixture = dependencies();
  const result = await validateFixture({
    action: 'check', environment: 'dev', endpointId: 'we_example', eventType: 'invoice.paid',
  }, fixture.values);
  assert.equal(result.cliResult, 'check-passed');
  assert.equal(fixture.calls.cli.length, 0);
  assert.equal(fixture.calls.removed.length, 1);
  assert.equal(JSON.stringify(result).includes('sk_test_hidden'), false);
});

test('fails closed on account mismatch before invoking the CLI', async () => {
  const fixture = dependencies({
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ id: 'acct_other' }) }),
  });
  await assert.rejects(() => validateFixture({
    action: 'trigger', environment: 'dev', endpointId: 'we_example', eventType: 'invoice.paid',
  }, fixture.values), /account mismatch/);
  assert.equal(fixture.calls.cli.length, 0);
});

test('trigger suppresses raw CLI output, confirms the event, and returns a truncated ID', async () => {
  const fixture = dependencies();
  const result = await validateFixture({
    action: 'trigger', environment: 'dev', endpointId: 'we_example', eventType: 'invoice.paid',
  }, fixture.values);
  assert.equal(result.eventId, 'evt_123456...');
  assert.equal(result.cliResult, 'trigger-succeeded');
  assert.deepEqual(fixture.calls.cli[0].args.slice(0, 3), ['--config', '/tmp/isolated-stripe/config.toml', 'trigger']);
  assert.equal(fixture.calls.cli[0].options.env.STRIPE_API_KEY, 'sk_test_hidden');
  assert.equal(JSON.stringify(result).includes('sk_test_hidden'), false);
  assert.equal(fixture.calls.removed.length, 1);
});

test('resend uses the verified event and endpoint in the isolated account', async () => {
  const fixture = dependencies();
  const result = await validateFixture({
    action: 'resend', environment: 'dev', endpointId: 'we_example', resendEventId: 'evt_1234567890',
  }, fixture.values);
  assert.equal(result.eventType, 'invoice.paid');
  assert.equal(result.cliResult, 'resend-succeeded');
  assert.ok(fixture.calls.cli[0].args.includes('we_example'));
  assert.ok(fixture.calls.cli[0].args.includes('--confirm'));
});

test('CLI failure is redacted and always cleans up temporary state', async () => {
  const fixture = dependencies({ execFileImpl: async () => { throw new Error('sk_test_hidden evt_full_secret'); } });
  await assert.rejects(() => validateFixture({
    action: 'trigger', environment: 'dev', endpointId: 'we_example', eventType: 'invoice.paid',
  }, fixture.values), (error) => {
    assert.equal(error.message.includes('sk_test_hidden'), false);
    assert.match(error.message, /output was suppressed/);
    return true;
  });
  assert.equal(fixture.calls.removed.length, 1);
});

test('redacts only recognized Stripe identifiers', () => {
  assert.equal(redactId('evt_1234567890'), 'evt_123456...');
  assert.equal(redactId('not-an-id'), 'redacted');
});
