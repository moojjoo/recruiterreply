#!/usr/bin/env node
// Fail closed: Dev requires both its explicit release gate and the reviewed
// edge association. Test has no enablement path in this rollout.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const frontend = fs.readFileSync(path.join(__dirname, '../../infra/aws/terraform/modules/frontend/main.tf'), 'utf8');
const enabledMatch = frontend.match(/\benabled\s*=\s*\(([\s\S]*?)\n\s*\)\n\s*is_ipv6_enabled/);
assert.ok(enabledMatch, 'CloudFront enabled expression must remain reviewable');
const enabledExpression = enabledMatch[1];
assert.match(
  enabledExpression,
  /each\.key\s*==\s*"prod"\s*\|\|[\s\S]*each\.key\s*==\s*"dev"\s*&&[\s\S]*var\.enable_private_dev_distribution\s*&&[\s\S]*var\.enable_private_edge_associations\s*&&[\s\S]*contains\(var\.private_edge_association_environments, each\.key\)/,
  'Dev must require explicit release, private edge association, and Dev-set membership gates'
);
assert.doesNotMatch(
  enabledExpression,
  /"test"/,
  'Test must remain disabled until separately authorized'
);
assert.equal(frontend.includes('\\n  #'), false, 'Terraform contains escaped newline text in a comment');
assert.match(frontend, /for_each\s*=\s*aws_s3_bucket\.this/,
  'CloudFront distribution set changed: review this safeguard');
console.log('Dev explicit-release and Test shutdown guards passed.');
