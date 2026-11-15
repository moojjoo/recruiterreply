'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {validateCommitSubject} = require('./commit-message-policy.cjs');

test('accepts a Conventional Commit with matching RR issue scope', () => {
  assert.deepEqual(validateCommitSubject('docs(RR-695): document commit traceability', 695), {
    valid: true,
    issueNumber: 695,
    type: 'docs',
  });
});

test('accepts every supported Conventional Commit type', () => {
  for (const type of ['feat', 'fix', 'refactor', 'chore', 'docs', 'style', 'test']) {
    assert.equal(validateCommitSubject(`${type}(RR-695): describe change`, 695).valid, true);
  }
});

test('rejects padded, missing, and mismatched issue scopes', () => {
  assert.equal(validateCommitSubject('docs(RR-0695): describe change', 695).valid, false);
  assert.equal(validateCommitSubject('docs(workflow): describe change', 695).valid, false);
  assert.equal(validateCommitSubject('docs(RR-695): describe change', 696).valid, false);
});

test('rejects unsupported Conventional Commit types', () => {
  assert.equal(validateCommitSubject('build(RR-695): describe change', 695).valid, false);
});
