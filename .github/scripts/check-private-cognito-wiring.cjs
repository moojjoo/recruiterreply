#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../infra/aws/terraform/global');
const variables = fs.readFileSync(path.join(root, 'private_environment_variables.tf'), 'utf8');
const wiring = fs.readFileSync(path.join(root, 'private_environment_identity.tf'), 'utf8');
const frontend = fs.readFileSync(path.join(root, '../modules/frontend/main.tf'), 'utf8');
const edgeVariables = fs.readFileSync(path.join(root, 'private_edge_variables.tf'), 'utf8');
const edgeWiring = fs.readFileSync(path.join(root, 'private_edge_runtime.tf'), 'utf8');
const edgeRuntimeState = fs.readFileSync(
  path.join(root, '../modules/private_edge_runtime_state/main.tf'),
  'utf8'
);
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
assert.match(frontend, /enabled\s*=\s*each\.key\s*==\s*"prod"\s*\?\s*true\s*:\s*false/);
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
console.log('Cognito and edge provisioning remain gated; Dev/Test remain disabled.');
