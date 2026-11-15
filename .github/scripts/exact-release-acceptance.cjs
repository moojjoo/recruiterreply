#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const {readFileSync, writeFileSync} = require('node:fs');

const outcomes = new Set(['passed', 'failed', 'blocked', 'skipped', 'not-run']);
const outcomePath = () => process.env.ACCEPTANCE_OUTCOME_PATH || 'exact-release-acceptance.json';

function releaseIdentity(env = process.env) {
  const environment = env.PLAYWRIGHT_ENV;
  assert.ok(environment === 'dev' || environment === 'test', 'PLAYWRIGHT_ENV must be dev or test');
  assert.match(env.DEPLOYED_SHA || '', /^[0-9a-f]{40}$/, 'DEPLOYED_SHA must be a full commit SHA');
  assert.match(env.BACKEND_DIGEST || '', /^sha256:[0-9a-f]{64}$/, 'BACKEND_DIGEST must be immutable');
  assert.match(env.TEST_REVISION || '', /^[0-9a-f]{40}$/, 'TEST_REVISION must be a deliberate full commit SHA');
  return {
    environment,
    deployedSha: env.DEPLOYED_SHA,
    backendDigest: env.BACKEND_DIGEST,
    testRevision: env.TEST_REVISION,
  };
}

function verify(env = process.env) {
  const identity = releaseIdentity(env);
  const checkedOut = execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
  assert.equal(checkedOut, identity.testRevision, 'Checked-out tests differ from TEST_REVISION');
  process.stdout.write(`Exact-release inputs verified: environment=${identity.environment}; deployed_sha=${identity.deployedSha}; backend_digest=${identity.backendDigest}; test_revision=${identity.testRevision}\n`);
}

function writeOutcome(status, env = process.env) {
  assert.ok(outcomes.has(status), 'Unsupported acceptance outcome');
  const document = {schema_version: 1, ...releaseIdentity(env), status};
  writeFileSync(outcomePath(), `${JSON.stringify(document, null, 2)}\n`, {mode: 0o600});
  return document;
}

function record(status, env = process.env) {
  assert.ok(outcomes.has(status) && status !== 'not-run', 'Recorded outcome must be terminal');
  const existing = JSON.parse(readFileSync(outcomePath(), 'utf8'));
  assert.equal(existing.status, 'not-run', 'Acceptance outcome is already terminal');
  writeOutcome(status, env);
}

if (require.main === module) {
  const [command, value] = process.argv.slice(2);
  if (command === 'verify') verify();
  else if (command === 'initialize') writeOutcome('not-run');
  else if (command === 'record') record(value);
  else throw new Error('Usage: exact-release-acceptance.cjs verify|initialize|record <outcome>');
}

module.exports = {outcomes, releaseIdentity, writeOutcome, record};
