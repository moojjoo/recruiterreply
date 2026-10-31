'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {linkedIssueReferences, acceptanceChecklistComplete, requiredCheckNames, blockers, report} = require('../issue-reconciliation-report.cjs');
const mergeSha = 'a'.repeat(40), headSha = 'b'.repeat(40);
const body = '## Acceptance criteria\n- [x] Verified\n\nDev-Completes: #320';
const pr = {number: 42, body, head: {sha: headSha}, merge_commit_sha: mergeSha, merged_at: 'now', base: {ref: 'main'}};
const issue = {number: 320, labels: [{name: 'dev-acceptance-verified'}]};
const names = ['verify', 'test', 'CodeQL required gate'];
const checks = names.map(name => ({name, head_sha: headSha, conclusion: 'success'}));
const deployment = {sha: mergeSha, conclusion: 'success', smokePassed: true};
const valid = {pr, issue, checks, requiredChecks: names, deployment, projectState: 'member', tokenConfigured: true};

test('discovers partial and final references with final taking precedence', () => {
  assert.deepEqual(linkedIssueReferences('Refs #12\nRefs: #13\nDev-Completes: #13'), [{number: 12, kind: 'partial'}, {number: 13, kind: 'final'}]);
});
test('acceptance checklist must contain checked and no unchecked items', () => {
  assert.equal(acceptanceChecklistComplete(body), true);
  assert.equal(acceptanceChecklistComplete('## Acceptance criteria\n- [x] One\n- [ ] Two'), false);
});
test('SEO is required only when frontend files changed', () => {
  assert.deepEqual(requiredCheckNames([{filename: 'backend/Program.cs'}]), names);
  assert.deepEqual(requiredCheckNames([{filename: 'frontend/src/App.tsx'}]), [...names, 'seo']);
});
test('complete evidence clears blockers', () => assert.deepEqual(blockers(valid), []));
test('partial PR is reported but cannot close', () => assert.match(blockers({...valid, referenceKind: 'partial'}).join(';'), /Dev-Completes/));
test('missing optional approval label is not a blocker', () => {
  assert.deepEqual(blockers({...valid, issue: {...issue, labels: []}}), []);
});
test('missing token is distinct from inaccessible project', () => {
  assert.match(blockers({...valid, tokenConfigured: false}).join(';'), /TOKEN/);
  assert.match(blockers({...valid, projectState: 'unavailable'}).join(';'), /unavailable/);
});
test('missing project is blocked', () => assert.match(blockers({...valid, projectState: 'missing'}).join(';'), /missing from/));
test('stale deployment SHA and missing smoke are blocked', () => {
  assert.match(blockers({...valid, deployment: {...deployment, sha: headSha}}).join(';'), /deployment/);
  assert.match(blockers({...valid, deployment: {...deployment, smokePassed: false}}).join(';'), /smoke/);
});
test('missing current-head check is blocked', () => assert.match(blockers({...valid, checks: checks.slice(0, 2)}).join(';'), /CodeQL/));
test('same evidence produces the same blockers', () => assert.deepEqual(blockers(valid), blockers(valid)));

test('report includes partial PRs and writes machine-readable evidence', async () => {
  const endpoints = {pulls: Symbol(), files: Symbol(), checks: Symbol(), runs: Symbol(), jobs: Symbol()};
  const github = {
    rest: {
      pulls: {list: endpoints.pulls, listFiles: endpoints.files}, checks: {listForRef: endpoints.checks},
      actions: {listWorkflowRunsForRepo: endpoints.runs, listJobsForWorkflowRun: endpoints.jobs},
      issues: {get: async () => ({data: {...issue, state: 'open', node_id: 'I_1'}})}
    },
    paginate: async endpoint => endpoint === endpoints.pulls ? [{...pr, body: '## Acceptance criteria\n- [x] Done\n\nRefs: #320'}]
      : endpoint === endpoints.files ? [{filename: 'backend/Program.cs'}]
      : endpoint === endpoints.checks ? checks
      : endpoint === endpoints.runs ? [{id: 7, name: 'Build and Deploy to Dev', head_sha: mergeSha, conclusion: 'success', html_url: 'https://example/run'}]
      : [{name: 'verify-dev-seo-http', conclusion: 'success', steps: [{name: 'Verify live Dev SEO responses', conclusion: 'success'}]}],
    graphql: async () => ({node: {projectItems: {nodes: [{project: {title: 'RecruiterReply Project'}}]}}})
  };
  const added = [];
  const core = {warning() {}, notice() {}, summary: {addRaw(value) { added.push(value); return this; }, async write() {}}};
  const outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'reconcile-'));
  const rows = await report({github, context: {repo: {owner: 'o', repo: 'r'}}, core, outputDirectory, tokenConfigured: true});
  assert.equal(rows[0].linkKind, 'partial');
  assert.match(rows[0].blockers.join(';'), /Dev-Completes/);
  const json = JSON.parse(fs.readFileSync(path.join(outputDirectory, 'report.json'), 'utf8'));
  assert.equal(json.schemaVersion, 1);
  assert.equal(json.candidates[0].issue, 320);
  assert.match(added[0], /Issue #?\|/i);
});
