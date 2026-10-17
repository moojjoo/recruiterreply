'use strict';

const { validateForwardingConfig } = require('./check-config.cjs');

function validateProvider(account, domain, aliases, requireReady = false) {
  if (account?.account?.plan?.price !== 0 || account.account.locked || account.account.over_quota) {
    throw new Error('provider account must be active and on the free plan');
  }
  const settings = domain?.domain;
  if (settings?.domain !== 'recruiterreply.com' || settings.banned !== false ||
      settings.routing_engine !== 'alias' || settings.rules_fallback_email !== null) {
    throw new Error('unapproved provider routing');
  }
  if (requireReady && settings.forwarding_ready !== true) throw new Error('forwarding is not ready');
  if (!Number.isInteger(aliases?.total) || aliases.total < 1 || aliases.total > 3 ||
      aliases.page !== 1 || aliases.aliases?.length !== aliases.total) {
    throw new Error('unexpected or incomplete provider alias inventory');
  }
  validateForwardingConfig({
    catchAll: aliases.aliases.some((entry) => entry.alias === '*'),
    aliases: aliases.aliases.map((entry) => ({
      source: `${entry.alias}@recruiterreply.com`, destination: entry.forward
    }))
  });
  return true;
}

async function checkProvider(requireReady = false) {
  const key = process.env.IMPROVMX_API_KEY;
  if (!key) throw new Error('provider credential is not configured');
  const read = async (path) => {
    const response = await fetch(`https://api.improvmx.com/v4/${path}`, {
      headers: { Authorization: `Basic ${Buffer.from(`api:${key}`).toString('base64')}` },
      signal: AbortSignal.timeout(15000), redirect: 'error'
    });
    if (!response.ok) throw new Error('provider read failed');
    return response.json();
  };
  // Three bounded GETs; never create aliases, upgrade a plan, or read mail logs.
  const account = await read('account');
  const domain = await read('domains/recruiterreply.com');
  const aliases = await read('domains/recruiterreply.com/aliases?limit=200&page=1');
  return validateProvider(account, domain, aliases, requireReady);
}

if (require.main === module) {
  checkProvider(process.argv.includes('--ready')).then(() => {
    process.stdout.write('PASS: free provider plan and approved catch-all routing. Inbox receipt remains pending.\n');
  }).catch(() => {
    process.stderr.write('FAIL/PENDING: provider configuration or credential unavailable; provider responses withheld.\n');
    process.exitCode = 1;
  });
}

module.exports = { validateProvider };
