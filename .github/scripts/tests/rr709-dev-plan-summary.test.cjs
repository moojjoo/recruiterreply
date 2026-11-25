'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const path = require('node:path');

const {
  EXPECTED_CREATES,
  PlanRejectionError,
  actionKind,
  safeAddressKind,
  summarize,
} = require('../rr709-dev-plan-summary.cjs');

const change = (address, actions, mode = 'managed', values = {}) => ({
  address,
  mode,
  change: { actions, before: values.before, after: values.after },
});

const approved = () => ({
  complete: true,
  applyable: true,
  errored: false,
  resource_changes: [
    ...EXPECTED_CREATES.map((address) => change(address, ['create'])),
    change('data.aws_route53_zone.application_managed_login[0]', ['read'], 'data'),
    change('module.private_environment_identity["test"].aws_cognito_user_pool.pool', ['no-op']),
  ],
});

test('emits only the three approved create addresses', () => {
  const plan = approved();
  plan.resource_changes[0].change.after = { client_secret: 'must-not-appear' };
  const summary = summarize(plan);

  assert.deepEqual(summary.split('\n'), EXPECTED_CREATES.map((address) => `- create \`${address}\``));
  assert.doesNotMatch(summary, /must-not-appear/);
});

for (const actions of [['update'], ['delete'], ['delete', 'create'], ['create', 'delete']]) {
  test(`rejects ${actions.join('/')} actions`, () => {
    const plan = approved();
    plan.resource_changes[0].change.actions = actions;
    assert.throws(() => summarize(plan), /unexpected-change/);
  });
}

test('rejects extra, missing, duplicate and out-of-scope creates', () => {
  const extra = approved();
  extra.resource_changes.push(change('aws_route53_record.unapproved', ['create']));
  assert.throws(() => summarize(extra), /unexpected-change-count/);

  const missing = approved();
  missing.resource_changes.shift();
  assert.throws(() => summarize(missing), /unexpected-change-count/);

  const duplicate = approved();
  duplicate.resource_changes[1] = duplicate.resource_changes[0];
  assert.throws(() => summarize(duplicate), /unexpected-change/);

  const wrong = approved();
  wrong.resource_changes[0].address = 'module.private_environment_identity["test"].aws_cognito_user_pool_domain.application_managed[0]';
  assert.throws(() => summarize(wrong), /unexpected-change/);
});

test('rejects managed reads and malformed plan data', () => {
  const managedRead = approved();
  managedRead.resource_changes.push(change('aws_cognito_user_pool.pool', ['read']));
  assert.throws(() => summarize(managedRead), /unexpected-change-count/);
  assert.throws(() => summarize({}), /invalid-plan/);
  assert.throws(() => summarize(null), /invalid-plan/);
});

test('rejects incomplete, inapplicable and errored plans', () => {
  for (const override of [
    { complete: false },
    { applyable: false },
    { errored: true },
  ]) {
    assert.throws(() => summarize({ ...approved(), ...override }), /invalid-plan/);
  }
});

test('classifies only allowlisted actions and redacts dynamic address identifiers', () => {
  assert.equal(actionKind(['delete', 'create']), 'replace');
  assert.equal(actionKind(['create', 'delete']), 'replace');
  assert.equal(actionKind(['forget']), 'unknown');
  assert.equal(
    safeAddressKind('module.identity["private-key-value"].aws_cognito_user_pool_client.user["private@example.test"]'),
    'managed:aws_cognito_user_pool_client',
  );
  assert.equal(safeAddressKind('not an address private@example.test'), 'unknown-address');
});

test('safe rejection diagnostics retain failure without values or dynamic identifiers', () => {
  const plan = approved();
  plan.resource_changes.push(change(
    'module.identity["private-key-value"].aws_cognito_user_pool_client.user["private@example.test"]',
    ['update'],
    'managed',
    {before: {client_secret: 'before-secret'}, after: {client_secret: 'after-secret'}},
  ));
  assert.throws(
    () => summarize(plan),
    (error) => {
      assert.ok(error instanceof PlanRejectionError);
      assert.match(error.diagnostic, /reason=unexpected-change-count/);
      assert.match(error.diagnostic, /update:managed:aws_cognito_user_pool_client/);
      assert.doesNotMatch(error.diagnostic, /private-key-value|private@example|client_secret|before-secret|after-secret/);
      return true;
    },
  );
});

test('CLI emits only sanitized rejection metadata and exits nonzero', () => {
  const plan = approved();
  plan.resource_changes.push(change(
    'module.identity["private-key-value"].aws_cognito_user_pool_client.user["private@example.test"]',
    ['update'],
    'managed',
    {after: {client_secret: 'must-not-appear'}},
  ));
  const result = spawnSync(
    process.execPath,
    [path.resolve(__dirname, '../rr709-dev-plan-summary.cjs')],
    {input: JSON.stringify(plan), encoding: 'utf8'},
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /update:managed:aws_cognito_user_pool_client/);
  assert.doesNotMatch(result.stderr, /private-key-value|private@example|client_secret|must-not-appear/);
  assert.equal(result.stdout, '');
});

test('moves, drift and deferred changes fail closed', () => {
  const moved = approved();
  moved.resource_changes.at(-1).previous_address = 'module.old["dynamic-identifier"].aws_cognito_user_pool.pool';
  assert.throws(() => summarize(moved), /moved-resource/);

  const drift = approved();
  drift.resource_drift = [change('aws_cognito_user_pool.pool["dynamic-identifier"]', ['update'])];
  assert.throws(() => summarize(drift), /resource-drift/);

  const deferred = approved();
  deferred.deferred_changes = [{reason: 'instance_count_unknown', private_value: 'must-not-appear'}];
  assert.throws(() => summarize(deferred), /deferred-changes/);
});

test('drift report uses fixed scopes, components and setting categories only', () => {
  const plan = approved();
  const bff = 'module.cognito_bff["dev"].aws_cognito_user_pool_client.bff';
  const gate = 'module.private_environment_identity["test"].aws_cognito_user_pool_client.browser';
  plan.resource_drift = [
    change(bff, ['update'], 'managed', {
      before: { callback_urls: ['before-secret'], 'untrusted-user-key': 'before-token' },
      after: { callback_urls: ['after-secret'], 'untrusted-user-key': 'after-token' },
    }),
    change(gate, ['update'], 'managed', {
      before: { supported_identity_providers: ['private-provider'] },
      after: { supported_identity_providers: ['different-private-provider'] },
    }),
    change('module.frontend.aws_cloudfront_distribution.this["prod"]', ['update'], 'managed', {
      before: { default_cache_behavior: [{ 'nested-private-key': 'before-private-scope' }] },
      after: { default_cache_behavior: [{ 'nested-private-key': 'after-private-scope' }] },
    }),
    change('module.github_oidc.aws_iam_role.github_actions', ['update'], 'managed', {
      before: { assume_role_policy: 'before-trust-document' },
      after: { assume_role_policy: 'after-trust-document' },
    }),
    {
      ...change('module.cognito_bff["dynamic-identifier"].aws_cognito_user_pool_client.bff', ['update'], 'managed', {
        before: { client_secret: 'before-client-secret' },
        after: { client_secret: 'after-client-secret' },
      }),
      type: 'aws_cognito_user_pool_client',
      previous_address: 'previous-private-address',
    },
    {
      ...change('secret-address', ['__proto__']),
      type: 'secret_type',
    },
  ];
  plan.relevant_attributes = [{ resource: bff, attribute: ['not-safe-path'] }];
  const result = spawnSync(process.execPath, [path.resolve(__dirname, '../rr709-dev-plan-summary.cjs')], {
    input: JSON.stringify(plan), encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /reason=resource-drift drift_count=6 unknown_scope_count=2 omitted_entry_count=0/);
  assert.match(result.stderr, /update:dev:app-auth-bff:cognito:1:other-setting\+redirects/);
  assert.match(result.stderr, /update:test:environment-gate:cognito:1:providers/);
  assert.match(result.stderr, /update:prod:frontend-distribution:edge-distribution:1:cache-or-association/);
  assert.match(result.stderr, /update:shared:deployment-role:iam:1:trust/);
  assert.match(result.stderr, /update:unknown-scope:unmapped-component:cognito:1:other-setting/);
  assert.match(result.stderr, /unknown:unknown-scope:unmapped-component:unknown-family:1:detail-unavailable/);
  assert.doesNotMatch(result.stderr,
    /secret|token|untrusted-user-key|private-provider|private-scope|private-key|trust-document|dynamic-identifier|previous-private-address|__proto__|not-safe-path|callback_urls|client_secret/);
});

test('counts all drift entries, groups repeated entries and includes no-op drift in the rejection', () => {
  const plan = approved();
  const target = 'module.frontend.aws_route53_record.prod_www["A"]';
  plan.resource_drift = Array.from({ length: 11 }, () => change(target, ['no-op'], 'managed', {
    before: { records: ['private-record'] }, after: { records: ['private-record'] },
  }));
  assert.throws(() => summarize(plan), ({ diagnostic }) => {
    assert.match(diagnostic, /drift_count=11 unknown_scope_count=0 omitted_entry_count=0/);
    assert.match(diagnostic, /no-op:prod:frontend-dns:dns:11:no-value-difference/);
    assert.doesNotMatch(diagnostic, /private-record/);
    return true;
  });
});

test('bounds output and accounts for entries in omitted groups', () => {
  const plan = approved();
  const target = 'module.frontend.aws_cloudfront_distribution.this["dev"]';
  const targets = [
    target,
    'module.frontend.aws_cloudfront_distribution.this["test"]',
    'module.frontend.aws_cloudfront_distribution.this["prod"]',
    'module.frontend.aws_cloudfront_function.spa_router["dev"]',
  ];
  plan.resource_drift = targets.flatMap((address) => [['create'], ['read'], ['update'], ['delete'], ['no-op']]
    .map((actions) => change(address, actions)));
  assert.throws(() => summarize(plan), ({ diagnostic }) => {
    assert.match(diagnostic, /drift_count=20 unknown_scope_count=0 omitted_entry_count=4/);
    assert.equal(diagnostic.split('groups=')[1].split(',').length, 16);
    return true;
  });
});
