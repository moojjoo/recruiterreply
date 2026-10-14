'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflows = path.resolve(__dirname, '../../workflows');
const audit = fs.readFileSync(path.join(workflows, 'terraform-readonly-audit.yml'), 'utf8');
const promotion = fs.readFileSync(path.join(workflows, 'promote-test.yml'), 'utf8');

test('Terraform audit uses Node 24 actions and a deliberate runner pin', () => {
  assert.match(audit, /runs-on:\s*ubuntu-24\.04/);
  assert.match(audit, /hashicorp\/setup-terraform@v4/);
  assert.match(audit, /aws-actions\/configure-aws-credentials@v6/);
  assert.doesNotMatch(audit, /hashicorp\/setup-terraform@v3/);
  assert.doesNotMatch(audit, /aws-actions\/configure-aws-credentials@v4/);
});

test('read-only OIDC and no-apply safeguards remain intact', () => {
  assert.match(audit, /id-token:\s*write/);
  assert.match(audit, /environment:\s*terraform-readonly-audit/);
  assert.match(audit, /terraform plan -refresh-only[^\n]*-lock=false[^\n]*-detailed-exitcode/);
  assert.match(audit, /terraform plan -input=false -lock=false -detailed-exitcode/);
  assert.doesNotMatch(audit, /terraform\s+apply/);
  assert.doesNotMatch(audit, /-auto-approve/);
});

test('Test promotion no longer invokes the Node 20 AWS action', () => {
  assert.match(promotion, /aws-actions\/configure-aws-credentials@v6/);
  assert.doesNotMatch(promotion, /aws-actions\/configure-aws-credentials@v4/);
});
