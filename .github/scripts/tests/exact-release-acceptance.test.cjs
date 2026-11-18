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
  TEST_REVISION: 'a'.repeat(40),
  ACCEPTANCE_REVISION: 'd'.repeat(40),
};

function trustedContext(overrides = {}) {
  const workflowSha = 'd'.repeat(40);
  const repositoryId = 12345;
  const runId = 67890;
  return {
    eventName: 'workflow_dispatch', ref: 'refs/heads/main', defaultBranch: 'main',
    workflowSha, checkedOutSha: workflowSha,
    workflowCommit: {sha: workflowSha},
    repository: 'moojjoo/recruiterreply', expectedRepository: 'moojjoo/recruiterreply',
    repositoryId, expectedRepositoryId: repositoryId,
    comparison: {
      status: 'ahead',
      base_commit: {sha: env.TEST_REVISION},
      merge_base_commit: {sha: env.TEST_REVISION},
      head_commit: null,
      ahead_by: 1,
      behind_by: 0,
    },
    artifact: {
      id: 456,
      name: `release-manifest-${env.PLAYWRIGHT_ENV}-${env.DEPLOYED_SHA}`,
      expired: false,
      workflow_run: {
        id: runId, head_sha: env.DEPLOYED_SHA, head_branch: 'main',
        head_repository_id: repositoryId,
      },
    },
    buildRun: {
      id: runId, head_sha: env.DEPLOYED_SHA, head_branch: 'main',
      conclusion: 'success', event: 'workflow_dispatch',
      path: '.github/workflows/build.yml@refs/heads/main',
    },
    manifest: {
      environment: env.PLAYWRIGHT_ENV, sha: env.DEPLOYED_SHA,
      backend_digest: env.BACKEND_DIGEST, status: 'success',
      run_url: `https://github.com/moojjoo/recruiterreply/actions/runs/${runId}`,
    },
    ...overrides,
  };
}

test('accepts immutable deployed and test identities', () => {
  assert.deepEqual(acceptance.releaseIdentity(env), {
    environment: 'dev', deployedSha: env.DEPLOYED_SHA,
    backendDigest: env.BACKEND_DIGEST, testRevision: env.TEST_REVISION,
    acceptanceRevision: env.ACCEPTANCE_REVISION,
  });
});

test('rejects mutable or malformed identities', () => {
  assert.throws(() => acceptance.releaseIdentity({...env, DEPLOYED_SHA: 'main'}), /DEPLOYED_SHA/);
  assert.throws(() => acceptance.releaseIdentity({...env, BACKEND_DIGEST: 'latest'}), /BACKEND_DIGEST/);
  assert.throws(() => acceptance.releaseIdentity({...env, PLAYWRIGHT_ENV: 'prod'}), /dev or test/);
  assert.throws(() => acceptance.releaseIdentity({...env, ACCEPTANCE_REVISION: 'main'}), /ACCEPTANCE_REVISION/);
});

test('accepts a merged immutable test revision and trusted exact release artifact', () => {
  const result = acceptance.verifyTrustedContext(trustedContext(), env);
  assert.equal(result.identity.testRevision, env.TEST_REVISION);
  assert.equal(result.artifactId, 456);
});

test('accepts an identical trusted test and workflow revision without a compare head object', () => {
  const context = trustedContext();
  context.workflowSha = env.TEST_REVISION;
  context.checkedOutSha = env.TEST_REVISION;
  context.workflowCommit = {sha: env.TEST_REVISION};
  context.comparison = {
    status: 'identical', ahead_by: 0, behind_by: 0,
    base_commit: {sha: env.TEST_REVISION},
    merge_base_commit: {sha: env.TEST_REVISION},
    head_commit: null,
  };
  const identicalEnv = {...env, ACCEPTANCE_REVISION: env.TEST_REVISION};
  assert.equal(acceptance.verifyTrustedContext(context, identicalEnv).identity.testRevision, env.TEST_REVISION);
});

test('rejects fork, arbitrary PR SHA, stale checkout and ref drift before credentials', () => {
  assert.throws(() => acceptance.verifyTrustedContext(trustedContext(), {
    ...env, TEST_REVISION: 'c'.repeat(40),
  }), /must equal DEPLOYED_SHA/);
  assert.throws(() => acceptance.verifyTrustedContext(trustedContext({
    repository: 'attacker/fork',
  }), env), /repository identity/);
  assert.throws(() => acceptance.verifyTrustedContext(trustedContext({
    comparison: {...trustedContext().comparison, merge_base_commit: {sha: 'e'.repeat(40)}},
  }), env), /not an ancestor/);
  assert.throws(() => acceptance.verifyTrustedContext(trustedContext({
    checkedOutSha: 'e'.repeat(40),
  }), env), /checkout drifted/);
  assert.throws(() => acceptance.verifyTrustedContext(trustedContext({
    workflowCommit: {sha: 'e'.repeat(40)},
  }), env), /workflow commit metadata/);
  assert.throws(() => acceptance.verifyTrustedContext(trustedContext({
    ref: 'refs/heads/untrusted-pr',
  }), env), /dispatched from main/);
});

test('rejects mismatched release manifest, deployed SHA, digest and workflow provenance', () => {
  assert.throws(() => acceptance.verifyTrustedContext(trustedContext({
    artifact: {...trustedContext().artifact,
      workflow_run: {...trustedContext().artifact.workflow_run, head_sha: 'e'.repeat(40)}},
  }), env), /artifact SHA/);
  assert.throws(() => acceptance.verifyTrustedContext(trustedContext({
    manifest: {...trustedContext().manifest, backend_digest: `sha256:${'e'.repeat(64)}`},
  }), env), /backend digest/);
  assert.throws(() => acceptance.verifyTrustedContext(trustedContext({
    buildRun: {...trustedContext().buildRun, path: '.github/workflows/untrusted.yml'},
  }), env), /trusted build workflow/);
  assert.throws(() => acceptance.verifyTrustedContext(trustedContext({
    buildRun: {...trustedContext().buildRun, conclusion: 'failure'},
  }), env), /did not succeed/);
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
