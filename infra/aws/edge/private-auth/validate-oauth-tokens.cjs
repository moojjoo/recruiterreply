'use strict';

const { validateIdToken } = require('./verify-id-token.cjs');
const { validateIdTokenNonce } = require('./oauth-nonce.cjs');

function validateOAuthTokens({
  idToken,
  jwks,
  config,
  expectedNonce,
  now
}) {
  const claims = validateIdToken(idToken, jwks, config, now);

  validateIdTokenNonce(claims, expectedNonce);

  return claims;
}

module.exports = { validateOAuthTokens };
