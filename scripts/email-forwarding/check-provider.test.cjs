'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateProvider } = require('./check-provider.cjs');
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
