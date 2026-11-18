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
  assert.match(authenticated, /ref: \$\{\{ github\.sha \}\}/);
  assert.match(authenticated, /ref: \$\{\{ needs\.preflight\.outputs\.acceptance_revision \}\}/);
  assert.doesNotMatch(authenticated, /ref: \$\{\{ needs\.preflight\.outputs\.test_revision \}\}/);
  assert.doesNotMatch(authenticated, /ref: \$\{\{ inputs\.test_revision \}\}/);
  assert.match(authenticated, /group: recruiterreply-shared-host-promotions/);
  assert.doesNotMatch(authenticated, /\$\{\{ runner\.temp \}\}/);
  assert.match(authenticated, /name: exact-release-acceptance-\$\{\{ inputs\.environment \}\}-\$\{\{ inputs\.deployed_sha \}\}/);
  assert.doesNotMatch(authenticated, /deployment_status:/);
});

test('credentialed acceptance executes only a main-ancestor revision after secretless provenance checks', () => {
  const preflight = authenticated.slice(authenticated.indexOf('  preflight:'), authenticated.indexOf('\n  test:'));
  const credentialed = authenticated.slice(authenticated.indexOf('\n  test:'));
  const browserStep = credentialed.indexOf('- name: Run authenticated browser validation');
  assert.ok(browserStep > 0);
  assert.doesNotMatch(preflight, /environment: \$\{\{ inputs\.environment \}\}/);
  assert.doesNotMatch(preflight, /secrets\./);
  assert.match(preflight, /github\.ref == 'refs\/heads\/main'/);
  assert.match(preflight, /github\.repository == 'moojjoo\/recruiterreply'/);
  assert.match(preflight, /--arg expectedRepository "moojjoo\/recruiterreply"/);
  assert.match(preflight, /--argjson expectedRepositoryId 1273232896/);
  assert.match(preflight, /compare\/\$\{TEST_REVISION\}\.\.\.\$\{GITHUB_SHA\}/);
  assert.match(preflight, /commits\/\$\{GITHUB_SHA\}/);
  assert.match(preflight, /verify-trust/);
  assert.match(preflight, /workflow_run\.head_branch == "main"/);
  assert.match(preflight, /workflow_run\.head_sha == \$sha/);
  assert.match(credentialed, /npm ci --ignore-scripts/);
  assert.match(credentialed, /TEST_REVISION remains exact-release evidence, not executable code/);
  assert.doesNotMatch(credentialed.slice(0, browserStep), /secrets\./);
  assert.match(credentialed.slice(browserStep), /PLAYWRIGHT_USERNAME: \$\{\{ secrets\.PLAYWRIGHT_USERNAME \}\}/);
  assert.match(credentialed, /EXPECTED_MANIFEST_HASH/);
  assert.match(credentialed, /test "\$actual_hash" = "\$EXPECTED_MANIFEST_HASH"/);
});

test('application login waits for an allowlisted credential destination', () => {
  assert.match(authenticatedSetup, /isAllowedCredentialDestination\(url\) \|\|/);
  assert.match(authenticatedSetup, /isAuthenticatedApplicationDestination\(url, applicationOrigin\)/);
  assert.match(authenticatedSetup, /waitForApprovedNavigation/);
  assert.match(authenticatedSetup, /timeout: 30_000, waitUntil: 'commit'/);
  assert.match(authenticatedSetup, /callbacks contain one-time code\/state values/);
  assert.doesNotMatch(authenticatedSetup, /url\.origin !== applicationOrigin \|\|/);
  assert.match(authenticatedSetup, /testInfo\.retry > 0/);
  assert.match(authenticatedSetup, /setup\.setTimeout\(90_000\)/);
});

test('Production promotion retains its independent public smoke path', () => {
  assert.match(promote, /if: inputs\.environment == 'prod'/);
  assert.match(promote, /FRONTEND_URL: \$\{\{ inputs\.frontend_url \}\}/);
  assert.doesNotMatch(promote, /DEV_SMOKE_(SESSION_COOKIE|API_TOKEN)/);
});

test('Dev no-op promotions never dispatch acceptance for an undeployed rebuilt digest', () => {
  const start = promote.indexOf('- name: Dispatch authenticated lower-environment validation');
  assert.ok(start >= 0);
  const dispatch = promote.slice(start);
  const condition = dispatch.match(/\n        if: ([^\n]+)/)?.[1];
  assert.equal(condition, "inputs.environment == 'test' || (inputs.environment == 'dev' && steps.idempotency.outputs.already_deployed == 'false')");
  // Evaluate the actual YAML expression against the GitHub Actions string outputs.
  const evaluate = (environment, alreadyDeployed) => {
    const expression = condition
      .replaceAll('inputs.environment', JSON.stringify(environment))
      .replaceAll('steps.idempotency.outputs.already_deployed', JSON.stringify(alreadyDeployed));
    return require('node:vm').runInNewContext(expression);
  };
  assert.equal(evaluate('dev', 'false'), true, 'fresh/forced Dev promotion dispatches');
  assert.equal(evaluate('dev', 'true'), false, 'no-op Dev promotion must not dispatch');
  assert.equal(evaluate('dev', ''), false, 'missing decision fails closed');
  assert.equal(evaluate('dev', 'unknown'), false, 'unknown decision fails closed');
  assert.equal(evaluate('prod', 'false'), false);
  assert.equal(evaluate('test', 'false'), true, 'existing Test behavior is unchanged');
  assert.equal(evaluate('test', 'true'), true, 'Test policy changes are out of scope');
});

test('Dev no-op reports not-run without manufacturing acceptance and keeps deliberate revalidation', () => {
  const start = promote.indexOf('- name: Report Dev no-op acceptance status');
  const end = promote.indexOf('- name: Dispatch authenticated lower-environment validation', start);
  assert.ok(start >= 0 && end > start);
  const step = promote.slice(start, end);
  assert.match(step, /if: inputs\.environment == 'dev' && steps\.idempotency\.outputs\.already_deployed == 'true'/);
  assert.match(step, /not run \(idempotent promotion\)/);
  assert.match(step, /not a new acceptance pass/);
  assert.doesNotMatch(step, /record passed|createWorkflowDispatch|curl|upload-artifact/);
  assert.match(authenticated, /workflow_dispatch:/);
  for (const field of ['deployed_sha', 'backend_digest', 'test_revision']) {
    assert.match(authenticated, new RegExp(field + ':\\n[^\\n]*\\n        required: true'));
  }
});
