#!/usr/bin/env node
// Fail closed: no release or infrastructure automation may enable Dev/Test
// before issue #356's reviewed Cognito edge gate is ready.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const frontend = fs.readFileSync(path.join(__dirname, '../../infra/aws/terraform/modules/frontend/main.tf'), 'utf8');
assert.match(frontend, /enabled\s*=\s*each\.key\s*==\s*"prod"\s*\?\s*true\s*:\s*false/,
  'CloudFront Dev/Test must remain disabled while Cognito gate is incomplete');
assert.match(frontend, /for_each\s*=\s*aws_s3_bucket\.this/,
  'CloudFront distribution set changed: review this safeguard');
console.log('Dev/Test CloudFront emergency shutdown guard passed.');
