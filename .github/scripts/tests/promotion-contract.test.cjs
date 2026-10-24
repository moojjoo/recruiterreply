'use strict';

const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const test = require('node:test');
const {
  documentedDispatches,
  unsupportedDispatchInputs,
  workflowDispatchInputs,
} = require('../promotion-contract.cjs');

const root = join(__dirname, '../..');
const skill = readFileSync(join(root, '../.agents/skills/promote-build/SKILL.md'), 'utf8');
const workflows = {
  'promote-test.yml': readFileSync(join(root, 'workflows/promote-test.yml'), 'utf8'),
  'promote-prod.yml': readFileSync(join(root, 'workflows/promote-prod.yml'), 'utf8'),
};

test('promotion instructions use only declared workflow_dispatch inputs', () => {
  assert.deepEqual(unsupportedDispatchInputs(skill, workflows), []);
  assert.deepEqual(documentedDispatches(skill), [
    {workflow: 'promote-test.yml', inputs: ['expected_sha']},
    {workflow: 'promote-prod.yml', inputs: ['expected_sha']},
  ]);
});

test('promotion instructions preserve environment provenance and separate approval', () => {
  assert.match(skill, /Test resolves from `dev`; production resolves from `test`/);
  assert.match(skill, /different SHA is a release race/);
  assert.match(skill, /fails before promotion\s+if it differs from `expected_sha`/);
  assert.match(skill, /production is a separate, deliberate action/);
  assert.match(skill, /confirm the new successful `prod` deployment records the\s+expected Test SHA/);
});

test('promotion wrappers fail closed on invalid or stale expected SHAs before reuse', () => {
  for (const [name, workflow] of Object.entries(workflows)) {
    assert.match(workflow, /expected_sha:\n\s+description:/, name);
    assert.match(workflow, /expected_sha:\n(?:.|\n)*?required: true/, name);
    assert.match(workflow, /EXPECTED_SHA: \$\{\{ inputs\.expected_sha \}\}/, name);
    assert.match(workflow, /\^\[a-f0-9\]\{40\}\$/, name);
    assert.match(workflow, /if \(deployment\.sha !== expectedSha\)/, name);
    assert.match(workflow, /core\.setFailed\(`Release race:/, name);
    assert.ok(
      workflow.indexOf('deployment.sha !== expectedSha') < workflow.indexOf("core.setOutput('sha'"),
      `${name} must enforce the expected SHA before exposing it to the reusable promotion`,
    );
  }
});

test('workflow input parser handles no inputs and declared inputs', () => {
  assert.deepEqual(workflowDispatchInputs('on:\n  workflow_dispatch:\npermissions:\n'), []);
  assert.deepEqual(workflowDispatchInputs(`on:
  workflow_dispatch:
    inputs:
      sha:
        required: true
      environment-name:
        required: false
permissions:
`), ['sha', 'environment-name']);
});

test('contract validator rejects unsupported inputs and missing workflows', () => {
  const markdown = [
    '`gh workflow run declared.yml --ref main -f sha=abc`',
    '`gh workflow run no-inputs.yml --ref main -f sha=abc`',
    '`gh workflow run missing.yml --ref main`',
  ].join('\n');
  const fixtureWorkflows = {
    'declared.yml': 'on:\n  workflow_dispatch:\n    inputs:\n      sha:\n        required: true\n',
    'no-inputs.yml': 'on:\n  workflow_dispatch:\n',
  };

  assert.deepEqual(unsupportedDispatchInputs(markdown, fixtureWorkflows), [
    'no-inputs.yml: unsupported documented input sha',
    'missing.yml: documented workflow is missing',
  ]);
});

test('contract validator rejects an omitted required input', () => {
  assert.deepEqual(unsupportedDispatchInputs(
    '`gh workflow run guarded.yml --ref main`',
    {'guarded.yml': 'on:\n  workflow_dispatch:\n    inputs:\n      expected_sha:\n        required: true\n'},
  ), ['guarded.yml: required input expected_sha is undocumented']);
});

test('contract validator rejects a documented workflow without manual dispatch', () => {
  assert.deepEqual(unsupportedDispatchInputs(
    '`gh workflow run push-only.yml --ref main`',
    {'push-only.yml': 'on:\n  push:\n    branches: [main]\n'},
  ), ['push-only.yml: workflow_dispatch is missing']);
});
