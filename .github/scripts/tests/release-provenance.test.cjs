'use strict';

const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const test = require('node:test');

const root = join(__dirname, '../..');
const build = readFileSync(join(root, 'workflows/build.yml'), 'utf8');
const promote = readFileSync(join(root, 'workflows/promote.yml'), 'utf8');

test('Dev build records and attests backend and frontend provenance', () => {
  assert.match(build, /attestations: write/);
  assert.match(build, /actions\/attest-build-provenance@96b4a1ef7235a096b17240c259729fdd70c83d45/);
  assert.match(build, /backend-release-\$\{\{ github\.sha \}\}/);
  assert.match(build, /frontend-build-manifest\.json/);
  assert.match(build, /source_sha/);
});

test('promotion verifies the build manifests before deploying the digest', () => {
  assert.match(promote, /backend-release-\$\{\{ inputs\.sha \}\}/);
  assert.match(promote, /\.repository == \$repository/);
  assert.match(promote, /\.source_sha == \$sha/);
  assert.match(promote, /backend_image=\$ECR_REGISTRY\/\$BACKEND_IMAGE_NAME@\$ECR_RESULT/);
  assert.doesNotMatch(promote, /backend_image=\$ECR_REGISTRY\/\$BACKEND_IMAGE_NAME:\$SHA/);
});

test('build records an aggregate release manifest and promotion verifies it', () => {
  assert.match(build, /name: release-manifest-\$\{\{ github\.sha \}\}/);
  assert.match(build, /schema_version:1/);
  assert.match(promote, /name: release-manifest-\$\{\{ inputs\.sha \}\}/);
  assert.match(promote, /\.build_run_id == \(\$run_id\|tonumber\)/);
  assert.match(promote, /\.status == "built"/);
});

test('all shared-host promotions use one non-canceling lock', () => {
  assert.match(promote, /group: recruiterreply-shared-host-promotions/);
  assert.match(promote, /cancel-in-progress: false/);
  assert.doesNotMatch(readFileSync(join(root, 'workflows/promote-test.yml'), 'utf8'), /group: promote-test/);
  assert.doesNotMatch(readFileSync(join(root, 'workflows/promote-prod.yml'), 'utf8'), /group: promote-prod/);
});

test('promotion detects a successful same-SHA deployment before mutation', () => {
  assert.match(promote, /name: Detect already deployed release/);
  assert.match(promote, /already_deployed.*true/);
  assert.match(promote, /skipping redeployment/);
});
