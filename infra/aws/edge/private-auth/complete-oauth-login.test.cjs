'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { test } = require('node:test');

const { completeOAuthLogin } = require('./complete-oauth-login.cjs');
const { createTransactionCookie } = require('./oauth-transaction.cjs');

const now = 1800000000000;
const transactionSecret = 'test-only-transaction-secret-at-least-32-bytes';
const sessionSecret = 'test-only-session-secret-at-least-32-bytes';
const state = 'A'.repeat(43);
const nonce = 'expected-login-nonce';
const verifier = 'B'.repeat(43);

const domain = 'recruiterreply-dev.auth.us-east-1.amazoncognito.com';
const issuer = 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_DEV';
const clientId = 'DevClient123';
const redirectUri = 'https://dev.recruiterreply.com/_auth/callback';

const environment = {
  approvedIdentity: { domain, issuer, clientId, redirectUri },
  oauth: {
    domain,
    approvedDomain: domain,
    clientId,
    approvedClientId: clientId,
    redirectUri,
    approvedRedirectUri: redirectUri
  },
  tokenConfig: { issuer, clientId },
  sessionConfig: { issuer, clientId }
};

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048
});

const jwk = publicKey.export({ format: 'jwk' });
Object.assign(jwk, {
  kid: 'callback-test-key',
  use: 'sig',
  alg: 'RS256'
});

function signedIdToken(overrides = {}) {
  const header = Buffer.from(JSON.stringify({
    alg: 'RS256',
    typ: 'JWT',
    kid: jwk.kid
  })).toString('base64url');

  const payload = Buffer.from(JSON.stringify({
    iss: issuer,
    aud: clientId,
    token_use: 'id',
    sub: 'callback-test-user',
    email_verified: true,
    iat: Math.floor(now / 1000) - 10,
    exp: Math.floor(now / 1000) + 600,
    nonce,
    ...overrides
  })).toString('base64url');

  const input = `${header}.${payload}`;
  const signature = crypto.sign(
    'RSA-SHA256',
    Buffer.from(input),
    privateKey
  ).toString('base64url');

  return `${input}.${signature}`;
}

function makeTransaction() {
  return createTransactionCookie({
    verifier,
    state,
    nonce,
    redirectUri
  }, transactionSecret, now).value;
}

function dependencies(token = signedIdToken()) {
  return {
    exchangeCode: async args => {
      assert.equal(args.code, 'test.authorization-code');
      assert.equal(args.verifier, verifier);
      return { id_token: token, access_token: 'mock-access-token' };
    },
    retrieveJwks: async (requestedIssuer, options) => {
      assert.equal(requestedIssuer, issuer);
      assert.equal(options.trustedIssuer, issuer);
      return { keys: [jwk] };
    }
  };
}

function loginArgs(overrides = {}) {
  return {
    query: { code: 'test.authorization-code', state },
    transactionCookie: makeTransaction(),
    transactionSecret,
    sessionSecret,
    environment,
    now,
    replayStore: {
      async consumeOnce() {
        return true;
      }
    },
    ...dependencies(),
    ...overrides
  };
}

test('successful OAuth login creates secure session and clears transaction', async () => {
  const result = await completeOAuthLogin(loginArgs());

  assert.match(result.sessionCookie, /^rr_session=/);
  assert.match(result.sessionCookie, /; Secure/);
  assert.match(result.sessionCookie, /; HttpOnly/);
  assert.match(result.sessionCookie, /; SameSite=Lax/);
  assert.match(result.clearTransactionCookie, /^rr_oauth_tx=;/);
  assert.match(result.clearTransactionCookie, /; Max-Age=0/);
  assert.equal(result.expiresIn, 900);
});

test('state mismatch prevents token exchange', async () => {
  let exchanged = false;

  await assert.rejects(
    completeOAuthLogin(loginArgs({
      query: { code: 'test.authorization-code', state: 'C'.repeat(43) },
      exchangeCode: async () => {
        exchanged = true;
        throw new Error('Must not exchange');
      }
    })),
    /OAuth state mismatch/
  );

  assert.equal(exchanged, false);
});

test('nonce mismatch prevents session creation', async () => {
  await assert.rejects(
    completeOAuthLogin(loginArgs({
      ...dependencies(signedIdToken({ nonce: 'wrong-nonce' }))
    })),
    /ID-token nonce mismatch/
  );
});

test('invalid ID-token signature prevents session creation', async () => {
  const parts = signedIdToken().split('.');
  parts[2] = Buffer.alloc(256).toString('base64url');

  await assert.rejects(
    completeOAuthLogin(loginArgs({
      ...dependencies(parts.join('.'))
    }))
  );
});

test('unapproved environment identity is rejected', async () => {
  await assert.rejects(
    completeOAuthLogin(loginArgs({
      environment: {
        ...environment,
        tokenConfig: { issuer, clientId: 'attacker-client' }
      }
    })),
    /OAuth environment identity mismatch/
  );
});

test('token-exchange failure prevents session creation', async () => {
  await assert.rejects(
    completeOAuthLogin(loginArgs({
      exchangeCode: async () => {
        throw new Error('OAuth token exchange failed');
      }
    })),
    /OAuth token exchange failed/
  );
});

test('missing replay store prevents token exchange and session creation', async () => {
  let exchanged = false;

  await assert.rejects(
    completeOAuthLogin(loginArgs({
      replayStore: undefined,
      exchangeCode: async () => {
        exchanged = true;
        throw new Error('Must not exchange');
      }
    })),
    /OAuth replay protection unavailable/
  );

  assert.equal(exchanged, false);
});

test('replay-store failure prevents token exchange and session creation', async () => {
  let exchanged = false;

  await assert.rejects(
    completeOAuthLogin(loginArgs({
      replayStore: {
        async consumeOnce() {
          throw new Error('simulated store outage');
        }
      },
      exchangeCode: async () => {
        exchanged = true;
        throw new Error('Must not exchange');
      }
    })),
    /OAuth replay protection unavailable/
  );

  assert.equal(exchanged, false);
});

test('already-consumed transaction cannot exchange authorization code again', async () => {
  let exchanged = false;

  await assert.rejects(
    completeOAuthLogin(loginArgs({
      replayStore: {
        async consumeOnce() {
          return false;
        }
      },
      exchangeCode: async () => {
        exchanged = true;
        throw new Error('Must not exchange');
      }
    })),
    /OAuth transaction already consumed/
  );

  assert.equal(exchanged, false);
});
