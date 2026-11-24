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
