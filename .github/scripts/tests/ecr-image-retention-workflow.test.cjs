'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../../..');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/ecr-image-retention.yml'), 'utf8');
const script = fs.readFileSync(path.join(root, '.github/scripts/ecr-image-retention.cjs'), 'utf8');
const terraform = fs.readFileSync(path.join(root,
  'infra/aws/terraform/modules/github_oidc/main.tf'), 'utf8');

test('ECR cleanup is manual, preview-first, digest-bound, and repository-scoped', () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /schedule:/);
  assert.match(workflow, /default: preview/);
  assert.match(workflow, /DELETE-ECR-DEV10-TEST5-PROD4/);
  assert.match(workflow, /expected_plan_digest/);
  assert.match(workflow, /resolve-image-retention-policy\.cjs/);
  assert.match(workflow, /ecr-image-retention\.cjs/);
  assert.match(script, /const REPOSITORY = 'recruiterreply-backend'/);
  assert.match(script, /repository must be/);
  assert.doesNotMatch(workflow, /aws ssm send-command/);
});

test('IAM grants deletion only on the RecruiterReply backend repository', () => {
  const statement = terraform.match(/Sid\s*=\s*"EcrRetentionBackend"[\s\S]*?\n\s*\}/)?.[0] || '';
  assert.match(statement, /ecr:BatchDeleteImage/);
  assert.match(statement, /ecr:DescribeImages/);
  assert.match(statement, /repository\/recruiterreply-backend/);
  assert.doesNotMatch(statement, /Resource\s*=\s*"\*"/);
});
