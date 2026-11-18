#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const {readFileSync, writeFileSync} = require('node:fs');

const outcomes = new Set(['passed', 'failed', 'blocked', 'skipped', 'not-run']);
const outcomePath = () => process.env.ACCEPTANCE_OUTCOME_PATH || 'exact-release-acceptance.json';
const shaPattern = /^[0-9a-f]{40}$/;
const digestPattern = /^sha256:[0-9a-f]{64}$/;
const pendingRunStatuses = new Set(['queued', 'in_progress', 'requested', 'waiting', 'pending']);

function releaseIdentity(env = process.env) {
  const environment = env.PLAYWRIGHT_ENV;
  assert.ok(environment === 'dev' || environment === 'test', 'PLAYWRIGHT_ENV must be dev or test');
  assert.match(env.DEPLOYED_SHA || '', shaPattern, 'DEPLOYED_SHA must be a full commit SHA');
  assert.match(env.BACKEND_DIGEST || '', digestPattern, 'BACKEND_DIGEST must be immutable');
  assert.match(env.TEST_REVISION || '', shaPattern, 'TEST_REVISION must be a deliberate full commit SHA');
  assert.match(env.ACCEPTANCE_REVISION || '', shaPattern, 'ACCEPTANCE_REVISION must be a trusted full commit SHA');
  return {
    environment,
    deployedSha: env.DEPLOYED_SHA,
    backendDigest: env.BACKEND_DIGEST,
    testRevision: env.TEST_REVISION,
    acceptanceRevision: env.ACCEPTANCE_REVISION,
  };
}

function verifyTrustedContext(context, env = process.env) {
  const identity = releaseIdentity(env);
  assert.equal(identity.testRevision, identity.deployedSha,
    'TEST_REVISION must equal DEPLOYED_SHA for exact-release evidence');
  assert.equal(identity.acceptanceRevision, context.workflowSha,
    'ACCEPTANCE_REVISION must equal the trusted workflow SHA');
  assert.equal(context.eventName, 'workflow_dispatch', 'Acceptance must be manually or promotion dispatched');
  assert.equal(context.ref, 'refs/heads/main', 'Acceptance executable must be dispatched from main');
  assert.equal(context.defaultBranch, 'main', 'Repository default branch must be main');
  assert.match(context.workflowSha || '', shaPattern, 'Workflow SHA must be immutable');
  assert.equal(context.checkedOutSha, context.workflowSha, 'Trusted preflight checkout drifted from workflow SHA');
  assert.equal(context.workflowCommit?.sha, context.workflowSha,
    'Trusted workflow commit metadata does not match the workflow SHA');
  assert.equal(context.repository, context.expectedRepository, 'Acceptance repository identity mismatch');
  assert.equal(context.repositoryId, context.expectedRepositoryId, 'Acceptance repository ID mismatch');

  assert.equal(context.comparison?.base_commit?.sha, identity.testRevision,
    'Comparison base is not TEST_REVISION');
  assert.equal(context.comparison?.merge_base_commit?.sha, identity.testRevision,
    'TEST_REVISION is not an ancestor of the trusted workflow SHA');
  assert.ok(context.comparison?.status === 'ahead' || context.comparison?.status === 'identical',
    'TEST_REVISION is not merged into the trusted main snapshot');
  assert.equal(context.comparison?.behind_by, 0,
    'Trusted main snapshot is behind TEST_REVISION');
  if (context.comparison.status === 'identical') {
    assert.equal(identity.testRevision, context.workflowSha,
      'Identical comparison does not match the trusted workflow SHA');
    assert.equal(context.comparison.ahead_by, 0, 'Identical comparison unexpectedly has ahead commits');
    assert.equal(context.comparison.behind_by, 0, 'Identical comparison unexpectedly has behind commits');
  } else assert.ok(context.comparison.ahead_by > 0, 'Ahead comparison contains no trusted commits');

  const expectedArtifact = `release-manifest-${identity.environment}-${identity.deployedSha}`;
  assert.equal(context.artifact?.name, expectedArtifact, 'Release artifact name mismatch');
  assert.equal(context.artifact?.expired, false, 'Release artifact is expired');
  assert.equal(context.artifact?.workflow_run?.head_sha, identity.deployedSha,
    'Release artifact SHA mismatch');
  assert.equal(context.artifact?.workflow_run?.head_branch, 'main',
    'Release artifact did not originate from main');
  assert.equal(context.artifact?.workflow_run?.head_repository_id, context.repositoryId,
    'Release artifact repository mismatch');

  assert.equal(assessBuildRun(
    context.buildRun, context.artifact, context.repositoryId, context.manifest, env,
  ), 'success',
    'Build run did not reach trusted success');

  assert.equal(context.manifest?.environment, identity.environment, 'Release environment mismatch');
  assert.equal(context.manifest?.sha, identity.deployedSha, 'Release manifest SHA mismatch');
  assert.equal(context.manifest?.backend_digest, identity.backendDigest, 'Release backend digest mismatch');
  assert.equal(context.manifest?.status, 'success', 'Release manifest is not successful');
  assert.equal(context.manifest?.run_url,
    `https://github.com/${context.repository}/actions/runs/${context.buildRun.id}`,
    'Release manifest run URL mismatch');
  return {identity, artifactId: context.artifact.id, buildRunId: context.buildRun.id};
}

function assessBuildRun(buildRun, artifact, repositoryId, manifest, env = process.env) {
  const identity = releaseIdentity(env);
  assert.equal(artifact?.name, `release-manifest-${identity.environment}-${identity.deployedSha}`,
    'Release artifact name mismatch');
  assert.equal(artifact?.expired, false, 'Release artifact is expired');
  assert.equal(artifact?.workflow_run?.head_sha, identity.deployedSha, 'Release artifact SHA mismatch');
  assert.equal(artifact?.workflow_run?.head_branch, 'main', 'Release artifact did not originate from main');
  assert.equal(artifact?.workflow_run?.head_repository_id, repositoryId,
    'Release artifact repository mismatch');
  assert.equal(buildRun?.id, artifact?.workflow_run?.id, 'Release artifact run mismatch');
  assert.equal(manifest?.run_id, buildRun?.id, 'Release manifest run mismatch');
  assert.equal(manifest?.run_attempt, buildRun?.run_attempt, 'Release manifest run attempt mismatch');
  assert.ok(Number.isInteger(buildRun?.run_attempt) && buildRun.run_attempt >= 1,
    'Build run attempt must be a positive integer');
  assert.equal(buildRun?.repository?.id, repositoryId, 'Build run repository mismatch');
  assert.equal(buildRun?.head_sha, identity.deployedSha, 'Build run SHA mismatch');
  assert.equal(buildRun?.head_branch, 'main', 'Build run branch mismatch');
  assert.ok(buildRun?.event === 'push' || buildRun?.event === 'workflow_dispatch',
    'Release artifact came from an unsupported event');
  assert.equal((buildRun?.path || '').split('@')[0], '.github/workflows/build.yml',
    'Release artifact did not originate from the trusted build workflow');

  if (buildRun.status === 'completed') {
    assert.equal(buildRun.conclusion, 'success', 'Build run completed without success');
    return 'success';
  }
  assert.ok(pendingRunStatuses.has(buildRun.status), 'Build run has an unsupported nonterminal status');
  assert.equal(buildRun.conclusion, null, 'Nonterminal build run unexpectedly has a conclusion');
  return 'pending';
}

function verify(env = process.env) {
  const identity = releaseIdentity(env);
  const checkedOut = execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
  assert.equal(checkedOut, identity.acceptanceRevision,
    'Checked-out harness differs from ACCEPTANCE_REVISION');
  process.stdout.write(`Exact-release inputs verified: environment=${identity.environment}; deployed_sha=${identity.deployedSha}; backend_digest=${identity.backendDigest}; test_revision=${identity.testRevision}; acceptance_revision=${identity.acceptanceRevision}\n`);
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
  else if (command === 'verify-trust') {
    assert.ok(value, 'verify-trust requires a context JSON path');
    verifyTrustedContext(JSON.parse(readFileSync(value, 'utf8')));
  }
  else if (command === 'assess-build-run') {
    const [artifactPath, repositoryPath, manifestPath] = process.argv.slice(4);
    assert.ok(value && artifactPath && repositoryPath && manifestPath,
      'assess-build-run requires build run, artifact, repository, and manifest JSON paths');
    const repository = JSON.parse(readFileSync(repositoryPath, 'utf8'));
    process.stdout.write(`${assessBuildRun(
      JSON.parse(readFileSync(value, 'utf8')),
      JSON.parse(readFileSync(artifactPath, 'utf8')),
      repository.id,
      JSON.parse(readFileSync(manifestPath, 'utf8')),
    )}\n`);
  }
  else if (command === 'initialize') writeOutcome('not-run');
  else if (command === 'record') record(value);
  else throw new Error('Usage: exact-release-acceptance.cjs verify|verify-trust|assess-build-run|initialize|record');
}

module.exports = {outcomes, releaseIdentity, assessBuildRun, verifyTrustedContext, writeOutcome, record};
