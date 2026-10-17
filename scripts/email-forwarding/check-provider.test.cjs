'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateProvider, checkProvider, formatFailure, ProviderCheckError } = require('./check-provider.cjs');
const fixture = () => [
  { account: { plan: { price: 0 } } },
  { domain: { domain: 'recruiterreply.com', banned: false, routing_engine: 'alias',
    rules_fallback_email: null, forwarding_ready: true } },
  { total: 3, page: 1, aliases: ['*', 'privacy', 'legal'].map((alias) => ({
    alias, forward: 'robert.dannelly@dannellysolutions.com'
  })) }
];
test('validates actual free-plan provider response', () => assert.equal(validateProvider(...fixture(), true), true));
test('rejects paid plan, missing catch-all, alternate routing, fallback and partial inventory', () => {
  const mutations = [
    (v) => { v[0].account.plan.price = 9; },
    (v) => { v[1].domain.routing_engine = 'rules'; },
    (v) => { v[1].domain.rules_fallback_email = 'elsewhere@example.com'; },
    (v) => { v[2].aliases[0].alias = 'support'; },
    (v) => { v[2].total = 4; },
    (v) => { v[2].page = 2; },
    (v) => { v[2].aliases[0].forward += ',elsewhere@example.com'; }
  ];
  for (const mutate of mutations) {
    const value = fixture(); mutate(value);
    assert.throws(() => validateProvider(...value));
  }
});
test('requires live forwarding readiness only after DNS apply', () => {
  const value = fixture(); value[1].domain.forwarding_ready = false;
  assert.equal(validateProvider(...value), true);
  assert.throws(() => validateProvider(...value, true));
});
test('reports specific validation failures without values from provider payloads', () => {
  const cases = [
    ['ACCOUNT_NOT_FREE', (v) => { v[0].account.plan.price = 9; }],
    ['ACCOUNT_UNAVAILABLE', (v) => { v[0].account.locked = true; }],
    ['DOMAIN_MISMATCH', (v) => { v[1].domain.domain = 'private-value'; }],
    ['DOMAIN_BANNED_OR_UNKNOWN', (v) => { delete v[1].domain.banned; }],
    ['ALIAS_ROUTING_NOT_ACTIVE', (v) => { v[1].domain.routing_engine = null; }],
    ['FALLBACK_DESTINATION_MISMATCH', (v) => { v[1].domain.rules_fallback_email = 'private-value'; }],
    ['ALIAS_INVENTORY_INVALID', (v) => { v[2].total = 4; }],
    ['ALIAS_CONFIGURATION_INVALID', (v) => { v[2].aliases[0].forward = 'private-value'; }]
  ];
  for (const [code, mutate] of cases) {
    const value = fixture(); mutate(value);
    assert.throws(() => validateProvider(...value), (error) => {
      const message = formatFailure(error);
      assert.ok(message.includes(code));
      assert.ok(!message.includes('private-value'));
      return true;
    });
  }
});
test('accepts only empty optional fallback metadata or the approved inbox under alias routing', () => {
  for (const fallback of [undefined, null, '', 'robert.dannelly@dannellysolutions.com']) {
    const value = fixture();
    if (fallback === undefined) delete value[1].domain.rules_fallback_email;
    else value[1].domain.rules_fallback_email = fallback;
    assert.equal(validateProvider(...value), true);
    value[1].domain.routing_engine = 'rules';
    assert.throws(() => validateProvider(...value), (error) => error.code === 'ALIAS_ROUTING_NOT_ACTIVE');
  }
});
test('rejects additional fallback destinations and malformed fallback metadata', () => {
  for (const fallback of ['elsewhere@example.com', 'robert.dannelly@dannellysolutions.com,elsewhere@example.com',
    [], {}, false, 0]) {
    const value = fixture(); value[1].domain.rules_fallback_email = fallback;
    assert.throws(() => validateProvider(...value), (error) => error.code === 'FALLBACK_DESTINATION_MISMATCH');
  }
});
test('empty fallback never substitutes for a complete approved catch-all inventory', () => {
  for (const fallback of [undefined, '', 'robert.dannelly@dannellysolutions.com']) {
    const value = fixture(); value[1].domain.rules_fallback_email = fallback;
    value[2].aliases[0].forward = 'elsewhere@example.com';
    assert.throws(() => validateProvider(...value), (error) => error.code === 'ALIAS_CONFIGURATION_INVALID');
    value[2].aliases = value[2].aliases.slice(1); value[2].total = 2;
    assert.throws(() => validateProvider(...value), (error) => error.code === 'ALIAS_CONFIGURATION_INVALID');
  }
});
test('missing credential fails before network access', async () => {
  await assert.rejects(checkProvider(false, { apiKey: '', fetchImpl: () => assert.fail('unexpected request') }),
    (error) => error.code === 'CREDENTIAL_MISSING');
});
test('HTTP failures report endpoint and status without reading provider error body', async () => {
  for (const [index, stage] of ['account', 'domain', 'aliases'].entries()) {
    let request = 0;
    await assert.rejects(checkProvider(false, { apiKey: 'sentinel', fetchImpl: async () => {
      if (request++ === index) return { ok: false, status: 401, json: () => assert.fail('error body must not be read') };
      return { ok: true, json: async () => fixture()[request - 1] };
    } }), (error) => {
      assert.match(formatFailure(error), new RegExp(`HTTP_FAILURE stage=${stage} HTTP=401`));
      assert.ok(!formatFailure(error).includes('sentinel'));
      return true;
    });
  }
});
test('network, JSON, and unexpected errors with sensitive content are sanitized', async () => {
  const secret = 'sensitive-sentinel';
  for (const [code, fetchImpl] of [
    ['NETWORK_FAILURE', async () => { throw new Error(secret); }],
    ['INVALID_JSON', async () => ({ ok: true, json: async () => { throw new Error(secret); } })]
  ]) {
    await assert.rejects(checkProvider(false, { apiKey: secret, fetchImpl }), (error) => {
      assert.ok(formatFailure(error).includes(code));
      assert.ok(!formatFailure(error).includes(secret));
      return true;
    });
  }
  assert.match(formatFailure(new Error(secret)), /UNEXPECTED_FAILURE/);
  assert.ok(!formatFailure(new ProviderCheckError(secret, secret, secret)).includes(secret));
});
test('successful transport uses three fixed GETs with no redirects and retains validation', async () => {
  let request = 0;
  const paths = ['account', 'domains/recruiterreply.com', 'domains/recruiterreply.com/aliases?limit=200&page=1'];
  assert.equal(await checkProvider(false, { apiKey: 'sentinel', fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.improvmx.com/v4/' + paths[request]);
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, 'Basic ' + Buffer.from('api:sentinel').toString('base64'));
    const payload = fixture()[request++];
    return { ok: true, json: async () => payload };
  } }), true);
  assert.equal(request, 3);
});
