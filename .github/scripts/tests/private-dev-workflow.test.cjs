'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');

const root = join(__dirname, '../..');
const build = readFileSync(join(root, 'workflows/build.yml'), 'utf8');
const promote = readFileSync(join(root, 'workflows/promote.yml'), 'utf8');

test('Dev deployment remains opt-in and passes only protected smoke credentials', () => {
  assert.match(build, /DEV_AUTHENTICATED_SMOKE_READY == 'true'/);
  assert.match(build, /DEV_SMOKE_SESSION_COOKIE: \$\{\{ secrets\.DEV_SMOKE_SESSION_COOKIE \}\}/);
  assert.match(build, /DEV_SMOKE_API_TOKEN: \$\{\{ secrets\.DEV_SMOKE_API_TOKEN \}\}/);
  assert.match(promote, /run: node \.github\/scripts\/private-dev-smoke\.cjs --authenticated/);
  assert.match(promote, /DEV_CLOUDFRONT_DOMAIN: \$\{\{ vars\.DEV_CLOUDFRONT_DOMAIN \}\}/);
});

test('Production promotion retains its independent public smoke path', () => {
  assert.match(promote, /if: inputs\.environment == 'prod'/);
  assert.match(promote, /FRONTEND_URL: \$\{\{ inputs\.frontend_url \}\}/);
  assert.doesNotMatch(promote, /DEV_SMOKE_SESSION_COOKIE.*inputs\.environment/);
});
