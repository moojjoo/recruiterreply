'use strict';

const {test} = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {validateGitHubActionsToken, getCiToken} = require('./github-oidc.cjs');

const config = {
  issuer: 'https://token.actions.githubusercontent.com',
  audience: 'recruiterreply-dev-smoke',
  repository: 'moojjoo/recruiterreply',
  workflowRef: 'moojjoo/recruiterreply/.github/workflows/promote.yml@refs/heads/main',
  ref: 'refs/heads/main',
  environment: 'dev'
};
const {privateKey, publicKey} = crypto.generateKeyPairSync('rsa', {modulusLength: 2048});
const jwk = {...publicKey.export({format: 'jwk'}), kid: 'github-test', use: 'sig', alg: 'RS256'};

function token(overrides = {}, now = 1_700_000_000) {
  const header = Buffer.from(JSON.stringify({alg: 'RS256', typ: 'JWT', kid: 'github-test'})).toString('base64url');
  const claims = {
    iss: config.issuer,
    aud: config.audience,
    repository: config.repository,
    job_workflow_ref: config.workflowRef,
    ref: config.ref,
    environment: config.environment,
    sub: 'repo:moojjoo/recruiterreply:environment:dev',
    iat: now - 30,
    exp: now + 300,
    ...overrides
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signed = `${header}.${payload}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(signed), privateKey).toString('base64url');
  return `${signed}.${signature}`;
}

test('valid GitHub Actions OIDC identity passes', () => {
  assert.equal(validateGitHubActionsToken(token(), {keys: [jwk]}, config, 1_700_000_000).repository, config.repository);
});

test('wrong scope, expiry, issuer, audience, workflow or environment fails closed', () => {
  for (const overrides of [
    {repository: 'attacker/repo'},
    {exp: 1_699_999_999},
    {iss: 'https://issuer.example'},
    {aud: 'other-audience'},
    {job_workflow_ref: 'moojjoo/recruiterreply/.github/workflows/other.yml@refs/heads/main'},
    {environment: 'prod'}
  ]) {
    assert.throws(() => validateGitHubActionsToken(token(overrides), {keys: [jwk]}, config, 1_700_000_000));
  }
});

test('ambiguous or unknown signing keys fail closed', () => {
  assert.throws(() => validateGitHubActionsToken(token(), {keys: []}, config, 1_700_000_000));
  assert.throws(() => validateGitHubActionsToken(token(), {keys: [jwk, jwk]}, config, 1_700_000_000));
});

test('CI header extraction rejects duplicates and oversized values', () => {
  const valid = token();
  assert.equal(getCiToken({headers: {'x-rr-ci-oidc-token': [{value: valid}]}}), valid);
  assert.equal(getCiToken({headers: {'x-rr-ci-oidc-token': [{value: valid}, {value: valid}]}}), null);
  assert.equal(getCiToken({headers: {'x-rr-ci-oidc-token': [{value: 'x'.repeat(8193)}]}}), null);
});
