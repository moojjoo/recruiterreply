'use strict';

const https = require('node:https');

const ISSUER = 'https://token.actions.githubusercontent.com';
const JWKS_URL = `${ISSUER}/.well-known/jwks`;
const MAX_RESPONSE_BYTES = 65536;
const REQUEST_TIMEOUT_MS = 3000;
const CACHE_TTL_MS = 300000;
let cached;

function fetchGitHubJwks() {
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.jwks);

  return new Promise((resolve, reject) => {
    const request = https.get(JWKS_URL, {
      timeout: REQUEST_TIMEOUT_MS,
      headers: {Accept: 'application/json'}
    }, response => {
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error('GitHub OIDC JWKS retrieval failed'));
        return;
      }

      let body = '';
      let bytes = 0;
      response.on('data', chunk => {
        bytes += chunk.length;
        if (bytes > MAX_RESPONSE_BYTES) {
          response.destroy(new Error('GitHub OIDC JWKS response too large'));
          return;
        }
        body += chunk.toString('utf8');
      });
      response.on('error', reject);
      response.on('end', () => {
        try {
          const jwks = JSON.parse(body);
          if (!jwks || !Array.isArray(jwks.keys)) throw new Error('Invalid GitHub OIDC JWKS');
          cached = {jwks, expiresAt: Date.now() + CACHE_TTL_MS};
          resolve(jwks);
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on('timeout', () => request.destroy(new Error('GitHub OIDC JWKS request timed out')));
    request.on('error', reject);
  });
}

module.exports = {fetchGitHubJwks};
