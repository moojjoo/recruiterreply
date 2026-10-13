#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../infra/aws/terraform/global');
const variables = fs.readFileSync(path.join(root, 'private_environment_variables.tf'), 'utf8');
const wiring = fs.readFileSync(path.join(root, 'private_environment_identity.tf'), 'utf8');
const frontend = fs.readFileSync(path.join(root, '../modules/frontend/main.tf'), 'utf8');
assert.match(variables, /variable "enable_private_environment_identity"\s*\{[^}]*default\s*=\s*false/s);
assert.match(wiring, /for_each\s*=\s*var\.enable_private_environment_identity\s*\?\s*toset\(\["dev", "test"\]\)\s*:\s*toset\(\[\]\)/);
assert.match(wiring, /source\s*=\s*"\.\.\/modules\/private_environment_identity"/);
assert.match(frontend, /enabled\s*=\s*each\.key\s*==\s*"prod"\s*\?\s*true\s*:\s*false/);
console.log('Cognito provisioning remains opt-in and Dev/Test remain disabled.');
