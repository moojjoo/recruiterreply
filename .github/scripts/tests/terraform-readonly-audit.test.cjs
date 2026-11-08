'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflows = path.resolve(__dirname, '../../workflows');
const audit = fs.readFileSync(path.join(workflows, 'terraform-readonly-audit.yml'), 'utf8');
const promotion = fs.readFileSync(path.join(workflows, 'promote-test.yml'), 'utf8');
const auditPolicy = fs.readFileSync(
  path.resolve(__dirname, '../../../infra/aws/terraform/global/terraform_audit_role.tf'),
  'utf8',
);
const frontendOutputs = fs.readFileSync(
  path.resolve(__dirname, '../../../infra/aws/terraform/modules/frontend/outputs.tf'),
  'utf8',
);

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

test('Terraform audit policy grants only the required metadata reads', () => {
  assert.match(auditPolicy, /"cognito-idp:DescribeResourceServer"/);
  assert.match(auditPolicy, /sid\s*=\s*"ReadManagedCertificateTags"[\s\S]*"acm:ListTagsForCertificate"[\s\S]*module\.frontend\.certificate_arns/);
  assert.match(auditPolicy, /sid\s*=\s*"ReadManagedBffSessionKeyPolicies"[\s\S]*"kms:GetKeyPolicy"[\s\S]*module\.bff_sessions\[0\]\.kms_key_arns/);
  assert.match(auditPolicy, /sid\s*=\s*"ListRegionalCloudWatchLogGroups"[\s\S]*"logs:DescribeLogGroups"[\s\S]*aws:RequestedRegion/);
  assert.match(frontendOutputs, /output "certificate_arns"/);
});

test('Terraform audit policy does not gain write or sensitive-data access', () => {
  assert.doesNotMatch(auditPolicy, /logs:(?:Put|Create|Delete)/);
  assert.doesNotMatch(auditPolicy, /kms:(?:Decrypt|Encrypt|GenerateDataKey)/);
  assert.doesNotMatch(auditPolicy, /cognito-idp:(?:Admin|ListUsers)/);
  assert.doesNotMatch(auditPolicy, /acm:(?:Import|Request|Delete)/);
});
