'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');

const root = join(__dirname, '../..');
const build = readFileSync(join(root, 'workflows/build.yml'), 'utf8');
const promote = readFileSync(join(root, 'workflows/promote.yml'), 'utf8');
const authenticated = readFileSync(join(root, 'workflows/playwright-authenticated.yml'), 'utf8');
const authenticatedSetup = readFileSync(join(root, '../tests/e2e/authenticated/auth.setup.ts'), 'utf8');

test('Dev deployment remains opt-in and mints only short-lived OIDC smoke credentials', () => {
  assert.match(build, /DEV_AUTHENTICATED_SMOKE_READY == 'true'/);
  assert.doesNotMatch(build, /DEV_SMOKE_(SESSION_COOKIE|API_TOKEN)/);
  assert.match(promote, /id-token: write/);
  assert.match(promote, /audience=recruiterreply-dev-smoke/);
  const deploy = promote.indexOf('- name: Deploy backend container on EC2');
  const authenticatedSmoke = promote.indexOf('- name: Verify private Dev deployed release identity');
  assert.ok(deploy >= 0 && authenticatedSmoke > deploy, 'machine OIDC health must run after the selected backend is deployed');
  const deployedIdentityStep = promote.slice(authenticatedSmoke, promote.indexOf('\n      - name:', authenticatedSmoke + 1));
  assert.match(deployedIdentityStep, /API_BASE_URL: \$\{\{ inputs\.api_base_url \}\}/);
  assert.match(deployedIdentityStep, /S3_FRONTEND_BUCKET: \$\{\{ vars\.S3_FRONTEND_BUCKET \}\}/);
  assert.match(promote, /DEV_SMOKE_OIDC_TOKEN="\$token" node \.github\/scripts\/private-dev-smoke\.cjs --authenticated/);
  assert.match(promote, /deployed_sha:\$deployed_sha,backend_digest:\$backend_digest,test_revision:\$test_revision/);
  assert.match(promote, /DEV_CLOUDFRONT_DOMAIN: \$\{\{ vars\.DEV_CLOUDFRONT_DOMAIN \}\}/);
});

test('authenticated acceptance is exact-release bound and shares the deployment lease', () => {
  for (const input of ['deployed_sha', 'backend_digest', 'test_revision']) {
    assert.match(authenticated, new RegExp(`\\n      ${input}:`));
  }
  assert.match(authenticated, /ref: \$\{\{ inputs\.test_revision \}\}/);
  assert.match(authenticated, /group: recruiterreply-shared-host-promotions/);
  assert.doesNotMatch(authenticated, /\$\{\{ runner\.temp \}\}/);
  assert.match(authenticated, /name: exact-release-acceptance-\$\{\{ inputs\.environment \}\}-\$\{\{ inputs\.deployed_sha \}\}/);
  assert.doesNotMatch(authenticated, /deployment_status:/);
});

test('application login waits for an allowlisted credential destination', () => {
  assert.match(authenticatedSetup, /isAllowedCredentialDestination\(url\) \|\|/);
  assert.match(authenticatedSetup, /isAuthenticatedApplicationDestination\(url, applicationOrigin\)/);
  assert.doesNotMatch(authenticatedSetup, /url\.origin !== applicationOrigin \|\|/);
  assert.match(authenticatedSetup, /testInfo\.retry > 0/);
  assert.match(authenticatedSetup, /setup\.setTimeout\(90_000\)/);
});

test('Production promotion retains its independent public smoke path', () => {
  assert.match(promote, /if: inputs\.environment == 'prod'/);
  assert.match(promote, /FRONTEND_URL: \$\{\{ inputs\.frontend_url \}\}/);
  assert.doesNotMatch(promote, /DEV_SMOKE_(SESSION_COOKIE|API_TOKEN)/);
});
