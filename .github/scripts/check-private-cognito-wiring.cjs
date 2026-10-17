#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../infra/aws/terraform/global');
const variables = fs.readFileSync(path.join(root, 'private_environment_variables.tf'), 'utf8');
const wiring = fs.readFileSync(path.join(root, 'private_environment_identity.tf'), 'utf8');
const frontend = fs.readFileSync(path.join(root, '../modules/frontend/main.tf'), 'utf8');
const frontendVariables = fs.readFileSync(
  path.join(root, '../modules/frontend/variables.tf'),
  'utf8'
);
const edgeVariables = fs.readFileSync(path.join(root, 'private_edge_variables.tf'), 'utf8');
const edgeWiring = fs.readFileSync(path.join(root, 'private_edge_runtime.tf'), 'utf8');
const edgeRuntimeState = fs.readFileSync(
  path.join(root, '../modules/private_edge_runtime_state/main.tf'),
  'utf8'
);
const identityModule = fs.readFileSync(
  path.join(root, '../modules/private_environment_identity/main.tf'),
  'utf8'
);
const enabledMatch = frontend.match(/\benabled\s*=\s*\(([\s\S]*?)\n\s*\)\n\s*is_ipv6_enabled/);
assert.ok(enabledMatch, 'CloudFront enabled expression must remain reviewable');
const enabledExpression = enabledMatch[1];
assert.match(variables, /variable "enable_private_environment_identity"\s*\{[^}]*default\s*=\s*false/s);
assert.match(
  variables,
  /variable "private_environment_identity_environments"\s*\{[\s\S]*?default\s*=\s*\["dev", "test"\][\s\S]*?contains\(\["dev", "test"\], env\)/
);
assert.match(
  wiring,
  /for_each\s*=\s*var\.enable_private_environment_identity\s*\?\s*var\.private_environment_identity_environments\s*:\s*toset\(\[\]\)/
);
assert.match(wiring, /source\s*=\s*"\.\.\/modules\/private_environment_identity"/);
assert.match(
  enabledExpression,
  /each\.key\s*==\s*"prod"\s*\|\|[\s\S]*each\.key\s*==\s*"dev"\s*&&[\s\S]*var\.enable_private_dev_distribution\s*&&[\s\S]*var\.enable_private_edge_associations\s*&&[\s\S]*contains\(var\.private_edge_association_environments, each\.key\)/
);
assert.doesNotMatch(enabledExpression, /"test"/, 'Test must have no enablement branch');
assert.match(
  fs.readFileSync(path.join(root, 'variables.tf'), 'utf8'),
  /variable "enable_private_dev_distribution"\s*\{[^}]*default\s*=\s*false/s
);
assert.match(
  frontendVariables,
  /variable "enable_private_dev_distribution"\s*\{[^}]*default\s*=\s*false/s
);
for (const variable of [
  'enable_private_edge_runtime_state',
  'enable_private_edge_functions',
  'enable_private_edge_associations'
]) {
  assert.match(
    edgeVariables,
    new RegExp(`variable "${variable}"\\s*\\{[^}]*default\\s*=\\s*false`, 's'),
    `${variable} must remain disabled by default`
  );
}
assert.match(edgeWiring, /private_edge_association_prerequisites/);
assert.match(
  edgeVariables,
  /variable "private_edge_environments"\s*\{[\s\S]*?default\s*=\s*\["dev", "test"\][\s\S]*?contains\(\["dev", "test"\], env\)/
);
assert.match(edgeWiring, /for_each\s*=\s*var\.enable_private_edge_runtime_state\s*\?\s*var\.private_edge_environments/);
assert.match(frontend, /viewer-request\s*=\s*var\.private_edge_function_arns\[each\.key\]/);
assert.match(frontend, /origin-response\s*=\s*var\.private_edge_function_arns\[each\.key\]/);
assert.match(frontend, /contains\(var\.private_edge_association_environments, each\.key\)/);
assert.doesNotMatch(
  edgeRuntimeState,
  /resource\s+"aws_secretsmanager_secret_version"/,
  'Signing-key values must never be managed in Terraform state'
);
assert.doesNotMatch(
  edgeRuntimeState,
  /point_in_time_recovery|deletion_protection_enabled/,
  'Ephemeral OAuth replay records must not enable paid recovery or deletion barriers'
);
assert.match(identityModule, /email_mfa_configuration\s*\{[\s\S]*\{####\}[\s\S]*10 minutes[\s\S]*\}/);
assert.match(identityModule, /YOUR VERIFICATION CODE/);
assert.match(identityModule, /user-select:all/);
assert.doesNotMatch(identityModule, /<button|<script/i, 'Cognito email must not advertise a nonfunctional copy control');
assert.match(identityModule, /auth_session_validity\s*=\s*10/);
console.log('Cognito and edge provisioning remain gated; Dev requires explicit release and Test remains disabled.');
