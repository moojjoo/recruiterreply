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
