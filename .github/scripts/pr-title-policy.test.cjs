'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {validatePullRequestTitle} = require('./pr-title-policy.cjs');
const {linkedIssueNumbers} = require('./pr-issue-linking.cjs');

test('accepts an RR title matching the linked repository issue', () => {
  const links = linkedIssueNumbers('Refs #544');
  assert.deepEqual(validatePullRequestTitle('RR-544: Optimize RecruiterReply pricing', links), {
    valid: true,
    issueNumber: 544,
  });
});

test('preserves final issue markers as the authoritative link', () => {
  const links = linkedIssueNumbers('Dev-Completes: #544');
  assert.equal(validatePullRequestTitle('RR-544: Document PR titles', links).valid, true);
});

test('rejects padded and mismatched issue numbers', () => {
  assert.equal(validatePullRequestTitle('RR-0544: Document PR titles', [544]).valid, false);
  assert.equal(validatePullRequestTitle('RR-544: Document PR titles', [545]).valid, false);
});

test('does not treat Conventional Commit syntax as a PR title', () => {
  assert.equal(validatePullRequestTitle('docs(workflow): clarify PR titles', [544]).valid, false);
});
