'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../..');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/dev-delegation-contract.yml'), 'utf8');

test('contract workflow is globally serialized, read-only, and checks out trusted main', () => {
  assert.match(workflow, /group: dev-delegation-contract-\$\{\{ github\.repository \}\}/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /issues: read/);
  assert.match(workflow, /pull-requests: read/);
  assert.doesNotMatch(workflow, /:\s*write\b/);
  assert.match(workflow, /ref: main/);
  assert.match(workflow, /persist-credentials: false/);
  assert.doesNotMatch(workflow, /pull_request\.head|github\.head_ref|checkout.*head/i);
  assert.equal((workflow.match(/uses: actions\/checkout@/g) || []).length, 1);
});

test('contract workflow cannot authorize or merge while disabled', () => {
  assert.match(workflow, /config\.enabled !== false/);
  assert.doesNotMatch(workflow, /pulls\.merge|enablePullRequestAutoMerge|createWorkflowDispatch|createComment|updateComment/);
});
