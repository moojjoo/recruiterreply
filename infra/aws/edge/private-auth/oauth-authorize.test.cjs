'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createAuthorizationRequest } = require('./oauth-authorize.cjs');

const approvedIdentity = {
  domain: 'recruiterreply-dev.auth.us-east-1.amazoncognito.com',
  clientId: 'DevClient123',
  redirectUri: 'https://dev.recruiterreply.com/_auth/callback'
};

function makeConfig(overrides = {}) {
  return {
    ...approvedIdentity,
    approvedIdentity: { ...approvedIdentity },
    ...overrides
  };
}

test('authorization URL uses code flow and PKCE S256', () => {
  const result = createAuthorizationRequest(makeConfig());
  const url = new URL(result.authorizationUrl);

  assert.equal(url.origin, `https://${approvedIdentity.domain}`);
  assert.equal(url.pathname, '/oauth2/authorize');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('client_id'), approvedIdentity.clientId);
  assert.equal(url.searchParams.get('redirect_uri'), approvedIdentity.redirectUri);
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('scope'), 'openid email');
  assert.ok(url.searchParams.get('code_challenge'));
});

test('OAuth state and nonce are present and transaction-bound', () => {
  const result = createAuthorizationRequest(makeConfig());
  const url = new URL(result.authorizationUrl);

  assert.equal(url.searchParams.get('state'), result.transaction.state);
  assert.equal(url.searchParams.get('nonce'), result.transaction.nonce);
  assert.ok(result.transaction.verifier);
  assert.equal(result.transaction.redirectUri, approvedIdentity.redirectUri);
});

test('unapproved Cognito domain is rejected', () => {
  assert.throws(
    () => createAuthorizationRequest(makeConfig({
      domain: 'attacker.auth.us-east-1.amazoncognito.com'
    })),
    /Untrusted OAuth configuration/
  );
});

test('callback URL from another environment is rejected', () => {
  assert.throws(
    () => createAuthorizationRequest(makeConfig({
      redirectUri: 'https://test.recruiterreply.com/_auth/callback'
    })),
    /Untrusted OAuth configuration/
  );
});

test('HTTP and external callback URLs are rejected', () => {
  for (const redirectUri of [
    'http://dev.recruiterreply.com/_auth/callback',
    'https://attacker.example/_auth/callback'
  ]) {
    assert.throws(
      () => createAuthorizationRequest(makeConfig({ redirectUri })),
      /Untrusted OAuth configuration/
    );
  }
});

test('configuration without independently approved identity is rejected', () => {
  assert.throws(
    () => createAuthorizationRequest({
      domain: approvedIdentity.domain,
      clientId: approvedIdentity.clientId,
      redirectUri: approvedIdentity.redirectUri
    }),
    /Untrusted OAuth configuration/
  );
});
