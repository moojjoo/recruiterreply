'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {classifyDependabotUpdate, validateReadiness} = require('../pr-readiness.cjs');

const base = {
  user: {login: 'dependabot[bot]'},
  base: {ref: 'main', repo: {full_name: 'moojjoo/recruiterreply'}},
  head: {ref: 'dependabot/npm_and_yarn/frontend/axios-1.20.1', repo: {full_name: 'moojjoo/recruiterreply'}},
  title: 'Bump axios from 1.20.0 to 1.20.1',
  body: 'Bumps axios from 1.20.0 to 1.20.1.',
  draft: false,
  labels: [],
  number: 1,
};
const files = [{filename: 'frontend/package-lock.json', status: 'modified'}];
const major = {...base, title: 'Bump axios from 1.20.0 to 2.0.0', body: 'Bumps axios from 1.20.0 to 2.0.0.'};

test('eligible patch update is trusted', () => {
  assert.deepEqual(classifyDependabotUpdate(base, files), {
    eligible: true,
    ecosystem: 'npm_and_yarn',
    updateType: 'patch',
    reason: 'Trusted npm/NuGet patch or minor Dependabot update',
  });
});

test('eligible minor update is trusted for NuGet', () => {
  const pr = {...base, head: {...base.head, ref: 'dependabot/nuget/backend/Npgsql-8.1.0'}, title: 'Bump Npgsql from 8.0.5 to 8.1.0', body: 'Bumps Npgsql from 8.0.5 to 8.1.0.'};
  assert.equal(classifyDependabotUpdate(pr, [{filename: 'backend/RecruiterReply.csproj', status: 'modified'}]).eligible, true);
  assert.equal(classifyDependabotUpdate(pr, [{filename: 'backend/RecruiterReply.csproj', status: 'modified'}]).updateType, 'minor');
});

test('major update is classified for manual review after validating its file scope', () => {
  assert.deepEqual(classifyDependabotUpdate(major, files), {
    eligible: false,
    ecosystem: 'npm_and_yarn',
    updateType: 'major',
    manualReviewRequired: true,
    reason: 'Major update requires manual review',
  });
});

test('major update is blocked until the repository owner approves the current commit', () => {
  const pr = {...major, head: {...major.head, sha: 'major-sha'}};
  const checks = [
    {name: 'verify', head_sha: 'major-sha', status: 'completed', conclusion: 'success'},
    {name: 'test', head_sha: 'major-sha', status: 'completed', conclusion: 'success'},
    {name: 'CodeQL required gate', head_sha: 'major-sha', status: 'completed', conclusion: 'success'},
    {name: 'Analyze (javascript-typescript)', head_sha: 'major-sha', status: 'completed', conclusion: 'success'},
  ];
  const blocked = validateReadiness({pr, checks, changedFiles: files, majorDependabotUpdate: true, maintainerApproved: false});
  assert.equal(blocked.eligible, false);
  assert.match(blocked.reasons.join('; '), /requires an approving review/);

  const approved = validateReadiness({pr, checks, changedFiles: files, majorDependabotUpdate: true, maintainerApproved: true});
  assert.equal(approved.eligible, true);
});

test('maintainer approval must match the current commit', () => {
  const {hasCurrentMaintainerApproval} = require('../pr-readiness.cjs');
  const reviews = [
    {user: {login: 'moojjoo'}, state: 'APPROVED', commit_id: 'old-sha'},
    {user: {login: 'moojjoo'}, state: 'APPROVED', commit_id: 'current-sha'},
  ];
  assert.equal(hasCurrentMaintainerApproval({reviews, ownerLogin: 'moojjoo', headSha: 'current-sha'}), true);
  assert.equal(hasCurrentMaintainerApproval({reviews, ownerLogin: 'moojjoo', headSha: 'other-sha'}), false);
  assert.equal(hasCurrentMaintainerApproval({
    reviews: [...reviews, {user: {login: 'moojjoo'}, state: 'DISMISSED', commit_id: 'current-sha'}],
    ownerLogin: 'moojjoo', headSha: 'current-sha',
  }), false);
});

for (const [name, mutate] of [
  ['major update', pr => ({...pr, title: 'Bump axios from 1.20.0 to 2.0.0', body: 'Bumps axios from 1.20.0 to 2.0.0.'})],
  ['spoofed author', pr => ({...pr, user: {login: 'octocat'}})],
  ['foreign source repository', pr => ({...pr, head: {...pr.head, repo: {full_name: 'octocat/recruiterreply'}}})],
  ['unsupported branch', pr => ({...pr, head: {...pr.head, ref: 'feature/dependency-update'}})],
  ['missing metadata', pr => ({...pr, title: 'Dependency update', body: 'Please review this update.'})],
  ['unsafe changed file', pr => pr],
]) {
  test(`rejects ${name}`, () => {
    const changed = name === 'unsafe changed file' ? [{filename: 'frontend/src/App.tsx', status: 'modified'}] : files;
    assert.equal(classifyDependabotUpdate(mutate(base), changed).eligible, false);
  });
}

test('trusted Dependabot metadata does not bypass required checks', () => {
  const pr = {...base, head: {...base.head, sha: 'abc'}};
  const trusted = classifyDependabotUpdate(pr, files);
  assert.equal(trusted.eligible, true);
  const result = validateReadiness({pr, changedFiles: files, trustedDependabotUpdate: true});
  assert.equal(result.eligible, false);
  assert.match(result.reasons.join('; '), /Missing current-SHA check/);
});

test('frontend-only trusted Dependabot update does not require skipped C# CodeQL', () => {
  const pr = {...base, head: {...base.head, sha: 'frontend-sha'}};
  const checks = [
    {name: 'verify', head_sha: 'frontend-sha', status: 'completed', conclusion: 'success'},
    {name: 'test', head_sha: 'frontend-sha', status: 'completed', conclusion: 'success'},
    {name: 'CodeQL required gate', head_sha: 'frontend-sha', status: 'completed', conclusion: 'success'},
    {name: 'Analyze (javascript-typescript)', head_sha: 'frontend-sha', status: 'completed', conclusion: 'success'},
  ];
  const result = validateReadiness({pr, checks, changedFiles: files, trustedDependabotUpdate: true});
  assert.equal(result.eligible, true);
});

test('GitHub Actions and Terraform updates always require manual review', () => {
  for (const [ecosystem, file] of [
    ['github_actions', '.github/workflows/build.yml'],
    ['terraform', 'infra/aws/terraform/global/versions.tf'],
  ]) {
    const pr = {
      ...base,
      head: {...base.head, ref: `dependabot/${ecosystem}/weekly-update`},
      title: 'Bump dependency from 1.2.3 to 1.2.4',
      body: 'Bumps dependency from 1.2.3 to 1.2.4.',
    };
    assert.equal(classifyDependabotUpdate(pr, [{filename: file, status: 'modified'}]).eligible, false);
  }
});
