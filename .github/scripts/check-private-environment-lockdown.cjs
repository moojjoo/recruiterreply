#!/usr/bin/env node
// Fail closed: each nonproduction distribution requires its release gate and edge association.
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
assert.match(
  enabledExpression,
  /each\.key\s*==\s*"test"\s*&&[\s\S]*var\.enable_private_test_distribution\s*&&[\s\S]*var\.enable_private_edge_associations\s*&&[\s\S]*contains\(var\.private_edge_association_environments, each\.key\)/,
  'Test must require its explicit release and private-edge gates'
);
const variables = fs.readFileSync(path.join(__dirname, '../../infra/aws/terraform/global/variables.tf'), 'utf8');
const moduleVariables = fs.readFileSync(path.join(__dirname, '../../infra/aws/terraform/modules/frontend/variables.tf'), 'utf8');
assert.match(variables, /variable "enable_private_test_distribution"\s*\{[^}]*default\s*=\s*false/s);
assert.match(variables, /variable "enable_private_test_api_routing"\s*\{[^}]*default\s*=\s*false/s);
assert.match(moduleVariables, /variable "enable_private_test_api_routing"\s*\{[^}]*default\s*=\s*false/s);
assert.match(frontend, /private_test_api_prerequisites/);
assert.match(frontend, /path_pattern\s*=\s*"\/api\/\*"/);
assert.match(frontend, /cache_policy_id\s*=\s*"4135ea2d-6df8-44a3-9df3-4b5a84be39ad"/);
assert.match(frontend, /event_type\s*=\s*"origin-request"/);
const backendAuth = fs.readFileSync(path.join(__dirname, '../../backend/Middleware/PrivateApiOriginAuthMiddleware.cs'), 'utf8');
assert.match(backendAuth, /X-RR-Origin-Auth/);
assert.match(backendAuth, /FixedTimeEquals/);
const edgeSigner = fs.readFileSync(path.join(__dirname, '../../infra/aws/edge/private-auth/viewer-request.cjs'), 'utf8');
assert.match(edgeSigner, /signApiOriginRequest/);
assert.match(edgeSigner, /apiOriginSigningKey/);
const promoteTest = fs.readFileSync(path.join(__dirname, '../workflows/promote-test.yml'), 'utf8');
assert.match(promoteTest, /api_base_url:\s*\/api\b/);
assert.match(promoteTest, /api_url:\s*https:\/\/test\.recruiterreply\.com\b/);
assert.equal(frontend.includes('\\n  #'), false, 'Terraform contains escaped newline text in a comment');
assert.match(frontend, /for_each\s*=\s*aws_s3_bucket\.this/,
  'CloudFront distribution set changed: review this safeguard');
console.log('Dev and Test release, API-routing, and origin-auth guards passed.');
