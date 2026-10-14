'use strict';

const https = require('node:https');

const MAX_RESPONSE_BYTES = 65536;
const REQUEST_TIMEOUT_MS = 3000;
const CACHE_TTL_MS = 300000;

const cache = new Map();

function fetchJwks(issuer, options = {}) {
  const trustedIssuer = options?.trustedIssuer;

  if (
    typeof issuer !== 'string' ||
    typeof trustedIssuer !== 'string' ||
    issuer !== trustedIssuer ||
    !/^https:\/\/cognito-idp\.us-east-1\.amazonaws\.com\/us-east-1_[A-Za-z0-9]+$/.test(issuer)
  ) {
    return Promise.reject(new Error('Untrusted Cognito issuer'));
  }

  const cached = cache.get(issuer);
  if (cached && cached.expiresAt > Date.now()) {
    return Promise.resolve(cached.jwks);
  }

  return new Promise((resolve, reject) => {
    const url = `${issuer}/.well-known/jwks.json`;

    const request = https.get(url, {
      timeout: REQUEST_TIMEOUT_MS,
      headers: { Accept: 'application/json' }
    }, response => {
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error('JWKS retrieval failed'));
        return;
      }

      let body = '';
      let bytes = 0;

      response.on('data', chunk => {
        bytes += chunk.length;

        if (bytes > MAX_RESPONSE_BYTES) {
          response.destroy(new Error('JWKS response too large'));
          return;
        }

        body += chunk.toString('utf8');
      });

      response.on('error', reject);

      response.on('end', () => {
        try {
          const jwks = JSON.parse(body);

          if (!jwks || !Array.isArray(jwks.keys)) {
            throw new Error('Invalid JWKS');
          }

          cache.set(issuer, {
            jwks,
            expiresAt: Date.now() + CACHE_TTL_MS
          });

          resolve(jwks);
        } catch (error) {
          reject(error);
        }
      });
    });

    request.on('timeout', () => {
      request.destroy(new Error('JWKS request timed out'));
    });

    request.on('error', reject);
  });
}

module.exports = { fetchJwks };
