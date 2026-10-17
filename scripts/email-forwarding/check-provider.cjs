'use strict';

const { validateForwardingConfig, EXPECTED_DESTINATION } = require('./check-config.cjs');

const FAILURE_CODES = new Set([
  'CREDENTIAL_MISSING', 'ACCOUNT_NOT_FREE', 'ACCOUNT_UNAVAILABLE',
  'DOMAIN_MISMATCH', 'DOMAIN_BANNED_OR_UNKNOWN', 'ALIAS_ROUTING_NOT_ACTIVE',
  'FALLBACK_DESTINATION_MISMATCH', 'FORWARDING_NOT_READY', 'ALIAS_INVENTORY_INVALID',
  'ALIAS_CONFIGURATION_INVALID', 'HTTP_FAILURE', 'NETWORK_FAILURE', 'INVALID_JSON'
]);

class ProviderCheckError extends Error {
  constructor(code, stage, status) {
    super('Provider check failed');
    this.code = code;
    this.stage = stage;
    this.status = status;
  }
}

function fail(code) { throw new ProviderCheckError(code); }

function formatFailure(error) {
  const code = error instanceof ProviderCheckError && FAILURE_CODES.has(error.code)
    ? error.code : 'UNEXPECTED_FAILURE';
  const stage = ['account', 'domain', 'aliases'].includes(error?.stage) ? ` stage=${error.stage}` : '';
  const status = Number.isInteger(error?.status) && error.status >= 100 && error.status <= 599
    ? ` HTTP=${error.status}` : '';
  return `FAIL/PENDING: provider check ${code}${stage}${status}; credentials and provider responses withheld.\n`;
}

function validateProvider(account, domain, aliases, requireReady = false) {
  if (account?.account?.plan?.price !== 0) fail('ACCOUNT_NOT_FREE');
  if (account.account.locked || account.account.over_quota) fail('ACCOUNT_UNAVAILABLE');
  const settings = domain?.domain;
  if (settings?.domain !== 'recruiterreply.com') fail('DOMAIN_MISMATCH');
  if (settings.banned !== false) fail('DOMAIN_BANNED_OR_UNKNOWN');
  if (settings.routing_engine !== 'alias') fail('ALIAS_ROUTING_NOT_ACTIVE');
  // Alias routing and the complete catch-all inventory are authoritative.
  // Empty optional rules metadata or the same approved inbox adds no recipient.
  const fallback = settings.rules_fallback_email;
  if (![undefined, null, '', EXPECTED_DESTINATION].includes(fallback)) fail('FALLBACK_DESTINATION_MISMATCH');
  if (requireReady && settings.forwarding_ready !== true) fail('FORWARDING_NOT_READY');
  if (!Number.isInteger(aliases?.total) || aliases.total < 1 || aliases.total > 3 ||
      aliases.page !== 1 || aliases.aliases?.length !== aliases.total) {
    fail('ALIAS_INVENTORY_INVALID');
  }
  try {
    validateForwardingConfig({
      catchAll: aliases.aliases.some((entry) => entry.alias === '*'),
      aliases: aliases.aliases.map((entry) => ({
        source: `${entry.alias}@recruiterreply.com`, destination: entry.forward
      }))
    });
  } catch { fail('ALIAS_CONFIGURATION_INVALID'); }
  return true;
}

async function checkProvider(requireReady = false, {
  apiKey = process.env.IMPROVMX_API_KEY, fetchImpl = fetch
} = {}) {
  if (!apiKey) fail('CREDENTIAL_MISSING');
  const read = async (stage, path) => {
    let response;
    try {
      response = await fetchImpl(`https://api.improvmx.com/v4/${path}`, {
        headers: { Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}` },
        signal: AbortSignal.timeout(15000), redirect: 'error'
      });
    } catch { throw new ProviderCheckError('NETWORK_FAILURE', stage); }
    if (!response.ok) throw new ProviderCheckError('HTTP_FAILURE', stage, response.status);
    try { return await response.json(); }
    catch { throw new ProviderCheckError('INVALID_JSON', stage); }
  };
  // Three bounded GETs; never create aliases, upgrade a plan, or read mail logs.
  const account = await read('account', 'account');
  const domain = await read('domain', 'domains/recruiterreply.com');
  const aliases = await read('aliases', 'domains/recruiterreply.com/aliases?limit=200&page=1');
  return validateProvider(account, domain, aliases, requireReady);
}

if (require.main === module) {
  checkProvider(process.argv.includes('--ready')).then(() => {
    process.stdout.write('PASS: free provider plan and approved catch-all routing. Inbox receipt remains pending.\n');
  }).catch((error) => {
    process.stderr.write(formatFailure(error));
    process.exitCode = 1;
  });
}

module.exports = { validateProvider, checkProvider, formatFailure, ProviderCheckError };
