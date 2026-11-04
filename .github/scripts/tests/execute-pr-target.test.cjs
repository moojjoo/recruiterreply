'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {resolveTargetPullRequestNumber} = require('../execute-pr-target.cjs');

test('resolves pull_request_target and pull_request_review payloads', () => {
  const payload = {pull_request: {number: 575}};
  assert.equal(resolveTargetPullRequestNumber('pull_request_target', payload), 575);
  assert.equal(resolveTargetPullRequestNumber('pull_request_review', payload), 575);
});

test('resolves a workflow_run associated with exactly one pull request', () => {
  const payload = {workflow_run: {pull_requests: [{number: 575}]}};
  assert.equal(resolveTargetPullRequestNumber('workflow_run', payload), 575);
});

test('resolves issue comments only when they belong to a pull request', () => {
  assert.equal(resolveTargetPullRequestNumber('issue_comment', {
    issue: {number: 577, pull_request: {url: 'https://api.github.com/repos/moojjoo/recruiterreply/pulls/577'}},
  }), 577);
  assert.equal(resolveTargetPullRequestNumber('issue_comment', {issue: {number: 578}}), null);
});

test('fails closed for missing, ambiguous, and unsupported payloads', () => {
  assert.equal(resolveTargetPullRequestNumber('pull_request_review', {}), null);
  assert.equal(resolveTargetPullRequestNumber('workflow_run', {workflow_run: {pull_requests: []}}), null);
  assert.equal(resolveTargetPullRequestNumber('workflow_run', {
    workflow_run: {pull_requests: [{number: 574}, {number: 575}]},
  }), null);
  assert.equal(resolveTargetPullRequestNumber('workflow_dispatch', {pull_request: {number: 575}}), null);
});
