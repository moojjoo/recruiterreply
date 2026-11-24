'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { EXPECTED_CREATES, summarize } = require('../rr709-dev-plan-summary.cjs');

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
