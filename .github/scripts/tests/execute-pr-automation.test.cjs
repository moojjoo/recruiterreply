'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflow = fs.readFileSync(path.join(__dirname, '../../workflows/execute-pr-automation.yml'), 'utf8');

test('trusted workflow accepts owner commands and serializes asynchronous reevaluation', () => {
  assert.match(workflow, /issue_comment:\s*\n\s*types: \[created\]/);
  assert.match(workflow, /concurrency:[\s\S]*cancel-in-progress: true/);
  assert.match(workflow, /context\.payload\.comment\?\.user\?\.login !== ownerLogin/);
  const untrustedBranch = workflow.match(/if \(context\.payload\.comment\?\.user\?\.login !== ownerLogin\) \{([\s\S]*?)\} else if/);
  assert.ok(untrustedBranch && !/\bcontinue\b/.test(untrustedBranch[1]));
  assert.match(workflow, /group: execute-pr-automation-.*pull_request\.number.*workflow_run\.pull_requests\[0\]\.number.*event\.issue\.number/);
  assert.match(workflow, /targetNumber = context\.payload\.pull_request\?\.number \|\|\s*context\.payload\.workflow_run\?\.pull_requests\?\.\[0\]\?\.number/);
  assert.match(workflow, /const prs = targetNumber[\s\S]*: \[\];/);
  assert.doesNotMatch(workflow, /workflow_dispatch:/);
  assert.match(workflow, /pull_request_review:[\s\S]*types: \[submitted, dismissed\]/);
  assert.doesNotMatch(workflow, /pull_request_review_thread:/);
});

test('high-risk authorization is invalidated on changed heads or revocation', () => {
  assert.match(workflow, /current\.head\.sha !== full\.head\.sha/);
  assert.match(workflow, /disablePullRequestAutoMerge/);
  assert.match(workflow, /ownerAuthorization:authorization\.authorized/);
});

test('high-risk merge is atomically bound to the re-read head SHA', () => {
  const cleanup = workflow.indexOf("risk === 'high' && item.autoMergeRequest");
  const readiness = workflow.indexOf('policy.validateReadiness');
  const reread = workflow.indexOf('current.head.sha !== full.head.sha');
  const expectedShaMerge = workflow.indexOf("sha:current.head.sha");
  const enable = workflow.indexOf('enablePullRequestAutoMerge');
  assert.ok(cleanup >= 0 && readiness > cleanup && reread > readiness && expectedShaMerge > reread && enable > expectedShaMerge);
  assert.match(workflow, /if \(risk === 'high'\)[\s\S]*github\.rest\.pulls\.merge/);
});
