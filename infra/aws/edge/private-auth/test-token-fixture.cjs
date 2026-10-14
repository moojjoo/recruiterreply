'use strict';

// Test-only cryptographic fixtures. Never deploy private keys to Lambda@Edge.
const crypto = require('node:crypto');

function createTokenFixture(environment) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048
  });

  const jwk = publicKey.export({ format: 'jwk' });
  Object.assign(jwk, {
    kid: `${environment}-test-key`,
    use: 'sig',
    alg: 'RS256'
  });

  const config = {
    issuer: `https://cognito-idp.us-east-1.amazonaws.com/us-east-1_${environment.toUpperCase()}`,
    clientId: `${environment}-client`
  };

  function signToken(overrides = {}) {
    const now = Math.floor(Date.now() / 1000);

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

  return {
    jwks: { keys: [jwk] },
    config,
    signToken
  };
}

module.exports = { createTokenFixture };
