'use strict';

function validateIdTokenNonce(claims, expectedNonce) {
  if (
    !claims ||
    typeof claims !== 'object' ||
    typeof claims.nonce !== 'string' ||
    typeof expectedNonce !== 'string' ||
    !expectedNonce ||
    claims.nonce !== expectedNonce
  ) {
    throw new Error('ID-token nonce mismatch');
  }

  return true;
}

module.exports = { validateIdTokenNonce };
