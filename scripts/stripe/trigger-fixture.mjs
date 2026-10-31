#!/usr/bin/env node

import { execFile as execFileCallback, execFileSync } from 'node:child_process';
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

import {
  ENVIRONMENTS, REQUIRED_EVENTS, STRIPE_API_VERSION, readEnvironmentSecret, validateSecret,
} from './reconcile-webhook.mjs';

const execFile = promisify(execFileCallback);
const ID_PATTERN = /^(evt|we)_[A-Za-z0-9]+$/;

export function parseArgs(args) {
  const result = { action: 'check' };
  let explicitAction;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--environment') result.environment = args[++index];
    else if (arg === '--endpoint-id') result.endpointId = args[++index];
    else if (arg === '--event') result.eventType = args[++index];
    else if (arg === '--trigger' || arg === '--check') {
      const action = arg.slice(2);
      if (explicitAction && explicitAction !== action) throw new Error('Specify exactly one action');
      explicitAction = action;
      result.action = action;
    }
    else if (arg === '--resend-event') {
      if (explicitAction && explicitAction !== 'resend') throw new Error('Specify exactly one action');
      explicitAction = 'resend';
      result.action = 'resend';
      result.resendEventId = args[++index];
    } else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!ENVIRONMENTS[result.environment]) throw new Error('--environment must be dev or test');
  if (!/^we_[A-Za-z0-9]+$/.test(result.endpointId ?? '')) {
    throw new Error('--endpoint-id must be a Stripe webhook endpoint ID');
  }
  if (result.action === 'resend') {
    if (!/^evt_[A-Za-z0-9]+$/.test(result.resendEventId ?? '')) {
      throw new Error('--resend-event must be a Stripe event ID');
    }
    if (result.eventType !== undefined) throw new Error('--event cannot be combined with --resend-event');
  } else if (!REQUIRED_EVENTS.includes(result.eventType)) {
    throw new Error(`--event must be one of: ${REQUIRED_EVENTS.join(', ')}`);
  }
  return result;
}

export function redactId(value) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) return 'redacted';
  return `${value.slice(0, 10)}...`;
}

export function buildCliEnvironment(baseEnvironment, secretKey, temporaryHome) {
  return {
    ...baseEnvironment,
    HOME: temporaryHome,
    STRIPE_API_KEY: secretKey,
  };
}

export async function findStripeCli({ environment = process.env, home = homedir(), accessImpl = access } = {}) {
  const pathCandidates = (environment.PATH ?? '').split(':').filter(Boolean).map((directory) => join(directory, 'stripe'));
  const candidates = [
    environment.STRIPE_CLI_PATH, join(home, '.stripe', 'bin', 'stripe'), ...pathCandidates,
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      await accessImpl(candidate);
      return candidate;
    } catch {
      // Try the next explicit location.
    }
  }
  throw new Error('Stripe CLI was not found; set STRIPE_CLI_PATH or install it in ~/.stripe/bin');
}

async function stripeRequest(path, secretKey, fetchImpl) {
  const response = await fetchImpl(`https://api.stripe.com${path}`, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Stripe-Version': STRIPE_API_VERSION,
    },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`Stripe API request failed (${response.status})`);
  return payload;
}

function validateEndpoint(endpoint, config) {
  const actualEvents = [...(endpoint.enabled_events ?? [])].sort();
  const expectedEvents = [...REQUIRED_EVENTS].sort();
  if (endpoint.livemode !== false || endpoint.url !== config.url
      || endpoint.api_version !== STRIPE_API_VERSION
      || JSON.stringify(actualEvents) !== JSON.stringify(expectedEvents)) {
    throw new Error('Stripe webhook destination does not match the selected environment contract');
  }
}

async function runCli(cli, args, options, execFileImpl) {
  try {
    await execFileImpl(cli, args, { ...options, encoding: 'utf8', maxBuffer: 1024 * 1024 });
  } catch {
    throw new Error('Stripe CLI command failed; output was suppressed to protect sandbox data');
  }
}

async function listRecentEvents(eventType, startedAt, secretKey, fetchImpl) {
  const query = new URLSearchParams({ type: eventType, 'created[gte]': String(startedAt), limit: '10' });
  return stripeRequest(`/v1/events?${query}`, secretKey, fetchImpl);
}

async function findCreatedEvent(eventType, startedAt, existingEventIds, secretKey, fetchImpl, sleepImpl) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const events = await listRecentEvents(eventType, startedAt, secretKey, fetchImpl);
    const event = events.data?.find((candidate) => candidate.type === eventType
      && candidate.livemode === false && !existingEventIds.has(candidate.id));
    if (event) return event;
    if (attempt < 4) await sleepImpl(1000);
  }
  throw new Error('No matching test-mode event appeared in the selected Stripe account');
}

export async function validateFixture(options, dependencies = {}) {
  const config = ENVIRONMENTS[options.environment];
  const secret = readEnvironmentSecret(config.secretId, dependencies.readSecret ?? dependencies.execFileSync ?? execFileSync);
  const { secretKey, expectedAccountId } = validateSecret(secret);
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const account = await stripeRequest('/v1/account', secretKey, fetchImpl);
  if (account.id !== expectedAccountId) {
    throw new Error(`Stripe account mismatch for ${options.environment}; refusing to continue`);
  }

  const endpoint = await stripeRequest(`/v1/webhook_endpoints/${options.endpointId}`, secretKey, fetchImpl);
  validateEndpoint(endpoint, config);

  const cli = await (dependencies.findCli ?? findStripeCli)({
    environment: dependencies.environment ?? process.env,
    home: dependencies.home ?? homedir(),
    accessImpl: dependencies.accessImpl ?? access,
  });
  const makeTemp = dependencies.mkdtempImpl ?? mkdtemp;
  const remove = dependencies.rmImpl ?? rm;
  const write = dependencies.writeFileImpl ?? writeFile;
  const temporaryDirectory = await makeTemp(join(dependencies.tmpdir ?? tmpdir(), 'recruiterreply-stripe-'));
  const configPath = join(temporaryDirectory, 'config.toml');
  const cliEnvironment = buildCliEnvironment(dependencies.environment ?? process.env, secretKey, temporaryDirectory);

  try {
    await write(configPath, '', { mode: 0o600 });
    const summary = {
      environment: options.environment,
      eventType: options.eventType,
      eventId: null,
      timestamp: new Date((dependencies.now ?? Date.now)()).toISOString(),
      cliResult: 'not-run',
    };
    if (options.action === 'check') return { ...summary, cliResult: 'check-passed' };

    const execute = dependencies.execFileImpl ?? execFile;
    if (options.action === 'resend') {
      const event = await stripeRequest(`/v1/events/${options.resendEventId}`, secretKey, fetchImpl);
      if (event.livemode !== false || !REQUIRED_EVENTS.includes(event.type)) {
        throw new Error('The resend event is not an allowed test-mode event');
      }
      await runCli(cli, [
        '--config', configPath, 'events', 'resend', options.resendEventId,
        '--webhook-endpoint', options.endpointId, '--confirm', '--color', 'off',
      ], { env: cliEnvironment }, execute);
      return {
        ...summary, eventType: event.type, eventId: redactId(event.id), cliResult: 'resend-succeeded',
      };
    }

    const startedAt = Math.floor((dependencies.now ?? Date.now)() / 1000) - 2;
    const existingEvents = await listRecentEvents(options.eventType, startedAt, secretKey, fetchImpl);
    const existingEventIds = new Set((existingEvents.data ?? []).map((event) => event.id));
    await runCli(cli, [
      '--config', configPath, 'trigger', options.eventType, '--color', 'off',
    ], { env: cliEnvironment }, execute);
    const event = await findCreatedEvent(
      options.eventType, startedAt, existingEventIds, secretKey, fetchImpl,
      dependencies.sleepImpl ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))),
    );
    return { ...summary, eventId: redactId(event.id), cliResult: 'trigger-succeeded' };
  } finally {
    await remove(temporaryDirectory, { recursive: true, force: true });
  }
}

async function main() {
  const result = await validateFixture(parseArgs(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
