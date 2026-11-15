'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {mkdtempSync, readFileSync, rmSync} = require('node:fs');
const {tmpdir} = require('node:os');
const {join} = require('node:path');
const acceptance = require('../exact-release-acceptance.cjs');

const env = {
  PLAYWRIGHT_ENV: 'dev',
  DEPLOYED_SHA: 'a'.repeat(40),
  BACKEND_DIGEST: `sha256:${'b'.repeat(64)}`,
  TEST_REVISION: 'c'.repeat(40),
};

test('accepts immutable deployed and test identities', () => {
  assert.deepEqual(acceptance.releaseIdentity(env), {
    environment: 'dev', deployedSha: env.DEPLOYED_SHA,
    backendDigest: env.BACKEND_DIGEST, testRevision: env.TEST_REVISION,
  });
});

test('rejects mutable or malformed identities', () => {
  assert.throws(() => acceptance.releaseIdentity({...env, DEPLOYED_SHA: 'main'}), /DEPLOYED_SHA/);
  assert.throws(() => acceptance.releaseIdentity({...env, BACKEND_DIGEST: 'latest'}), /BACKEND_DIGEST/);
  assert.throws(() => acceptance.releaseIdentity({...env, PLAYWRIGHT_ENV: 'prod'}), /dev or test/);
});

test('records one honest terminal outcome', () => {
  const directory = mkdtempSync(join(tmpdir(), 'acceptance-outcome-'));
  const previous = process.env.ACCEPTANCE_OUTCOME_PATH;
  process.env.ACCEPTANCE_OUTCOME_PATH = join(directory, 'outcome.json');
  try {
    acceptance.writeOutcome('not-run', env);
    acceptance.record('blocked', env);
    const document = JSON.parse(readFileSync(process.env.ACCEPTANCE_OUTCOME_PATH, 'utf8'));
    assert.equal(document.status, 'blocked');
    assert.throws(() => acceptance.record('passed', env), /already terminal/);
  } finally {
    if (previous === undefined) delete process.env.ACCEPTANCE_OUTCOME_PATH;
    else process.env.ACCEPTANCE_OUTCOME_PATH = previous;
    rmSync(directory, {recursive: true, force: true});
  }
});
