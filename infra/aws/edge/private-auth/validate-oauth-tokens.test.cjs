'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { test } = require('node:test');

const { validateOAuthTokens } = require('./validate-oauth-tokens.cjs');

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048
});

const now = 1800000000;
const expectedNonce = 'nonce-from-original-login';

const jwk = publicKey.export({ format: 'jwk' });
Object.assign(jwk, {
  kid: 'oauth-test-key',
  use: 'sig',
  alg: 'RS256'
});

const config = {
  issuer: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_TEST',
  clientId: 'oauth-test-client'
};

function makeToken(overrides = {}) {
  const header = Buffer.from(JSON.stringify({
    alg: 'RS256',
    typ: 'JWT',
    kid: jwk.kid
  })).toString('base64url');

  const payload = Buffer.from(JSON.stringify({
    iss: config.issuer,
    aud: config.clientId,
    token_use: 'id',
    sub: 'test-user',
    email_verified: true,
    iat: now - 10,
    exp: now + 600,
    nonce: expectedNonce,
    ...overrides
  })).toString('base64url');

  const signingInput = `${header}.${payload}`;
  const signature = crypto.sign(
    'RSA-SHA256',
    Buffer.from(signingInput),
    privateKey
  ).toString('base64url');

  return `${signingInput}.${signature}`;
}

test('valid signed ID token with matching nonce is accepted', () => {
  const claims = validateOAuthTokens({
    idToken: makeToken(),
    jwks: { keys: [jwk] },
    config,
    expectedNonce,
    now
  });

  assert.equal(claims.sub, 'test-user');
});

test('validly signed ID token with wrong nonce is rejected', () => {
  assert.throws(
    () => validateOAuthTokens({
      idToken: makeToken({ nonce: 'wrong-nonce' }),
      jwks: { keys: [jwk] },
      config,
      expectedNonce,
      now
    }),
    /ID-token nonce mismatch/
  );
});

test('invalid signature is rejected before nonce acceptance', () => {
  const parts = makeToken().split('.');
  parts[2] = Buffer.alloc(256).toString('base64url');

  assert.throws(
    () => validateOAuthTokens({
      idToken: parts.join('.'),
      jwks: { keys: [jwk] },
      config,
      expectedNonce,
      now
    })
  );
});

test('wrong audience is rejected even with matching nonce', () => {
  assert.throws(
    () => validateOAuthTokens({
      idToken: makeToken({ aud: 'wrong-client' }),
      jwks: { keys: [jwk] },
      config,
      expectedNonce,
      now
    }),
    /Wrong token issuer, audience or use/
  );
});
