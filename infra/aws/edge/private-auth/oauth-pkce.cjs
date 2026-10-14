'use strict';

const crypto = require('node:crypto');

function generatePkce() {
  const verifier = crypto.randomBytes(32).toString('base64url');

  const challenge = crypto
    .createHash('sha256')
    .update(verifier, 'ascii')
    .digest('base64url');

  return {
    verifier,
    challenge,
    method: 'S256'
  };
}

function generateOAuthState() {
  return crypto.randomBytes(32).toString('base64url');
}

function generateNonce() {
  return crypto.randomBytes(32).toString('base64url');
}

module.exports = {
  generatePkce,
  generateOAuthState,
  generateNonce
};
