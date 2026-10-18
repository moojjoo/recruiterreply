const test = require('node:test');
const assert = require('node:assert/strict');
const {issueNumberFromPullRequest, linkedIssueNumbers, acceptanceChecklistComplete, ensureIssueLink} = require('./pr-issue-linking.cjs');

test('detects issue number from managed branch names', () => {
  assert.equal(issueNumberFromPullRequest({head: {ref: 'feature/451-auto-close-linked-issues'}}), 451);
  assert.equal(issueNumberFromPullRequest({head: {ref: 'fix/22-auth'}}), 22);
});

test('detects issue number from execute command when branch is generic', () => {
  assert.equal(issueNumberFromPullRequest({head: {ref: 'work'}, body: 'Implemented via /execute 451'}), 451);
});

test('adds a partial link until acceptance criteria are complete', () => {
  const body = '## Acceptance criteria\n- [ ] Verify CI';
  assert.equal(acceptanceChecklistComplete(body), false);
  assert.match(ensureIssueLink(body, 451), /Refs #451/);
  assert.deepEqual(linkedIssueNumbers(ensureIssueLink(body, 451)), [451]);
});

test('adds the guarded completion marker only for a complete checklist', () => {
  const body = '## Acceptance criteria\n- [x] Verify CI';
  assert.equal(acceptanceChecklistComplete(body), true);
  assert.match(ensureIssueLink(body, 451), /Dev-Completes: #451/);
});

test('does not duplicate an existing issue link', () => {
  const body = '## Acceptance criteria\n- [x] Verify CI\n\nDev-Completes: #451';
  assert.equal(ensureIssueLink(body, 451), body);
});
