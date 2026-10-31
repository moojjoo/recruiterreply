'use strict';

const crypto = require('node:crypto');

const ISSUER = 'https://token.actions.githubusercontent.com';

function parseSegment(segment) {
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) throw new Error('Malformed OIDC token');
  const raw = Buffer.from(segment, 'base64url');
  if (raw.length > 16384) throw new Error('OIDC token segment too large');
  return JSON.parse(raw.toString('utf8'));
}

function validateGitHubActionsToken(token, jwks, config, now = Math.floor(Date.now() / 1000)) {
  if (typeof token !== 'string' || token.length > 8192) throw new Error('Invalid OIDC token');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid OIDC token format');

  const header = parseSegment(parts[0]);
  const claims = parseSegment(parts[1]);
  if (header.alg !== 'RS256' || (header.typ && header.typ !== 'JWT')) throw new Error('Unsupported OIDC algorithm');
  if (typeof header.kid !== 'string' || !header.kid || header.kid.length > 256) throw new Error('Missing OIDC key ID');
  if (!config || config.issuer !== ISSUER || typeof config.audience !== 'string' || !config.audience) {
    throw new Error('Missing OIDC configuration');
  }

  if (
    claims.iss !== ISSUER ||
    claims.aud !== config.audience ||
    claims.repository !== config.repository ||
    claims.job_workflow_ref !== config.workflowRef ||
    claims.ref !== config.ref ||
    claims.environment !== config.environment ||
    typeof claims.sub !== 'string' ||
    !claims.sub
  ) throw new Error('OIDC identity is not approved');

  if (!Number.isInteger(claims.exp) || claims.exp <= now) throw new Error('Expired OIDC token');
  if (!Number.isInteger(claims.iat) || claims.iat > now + 30 || claims.iat < now - 900) throw new Error('Invalid OIDC issuance time');
  if (claims.nbf !== undefined && (!Number.isInteger(claims.nbf) || claims.nbf > now)) throw new Error('OIDC token not yet valid');
  if (!jwks || !Array.isArray(jwks.keys)) throw new Error('Invalid OIDC JWKS');

  const matches = jwks.keys.filter(key => key.kid === header.kid && key.kty === 'RSA' && key.use === 'sig' && key.alg === 'RS256');
  if (matches.length !== 1) throw new Error('Unknown or ambiguous OIDC signing key');
  const key = crypto.createPublicKey({key: matches[0], format: 'jwk'});
  if (!/^[A-Za-z0-9_-]+$/.test(parts[2])) throw new Error('Malformed OIDC signature');
  if (!crypto.verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), key, Buffer.from(parts[2], 'base64url'))) {
    throw new Error('Invalid OIDC signature');
  }
  return claims;
}

function getCiToken(request) {
  const headers = request?.headers?.['x-rr-ci-oidc-token'];
  if (!Array.isArray(headers) || headers.length !== 1) return null;
  const token = headers[0]?.value;
  return typeof token === 'string' && token.length <= 8192 ? token : null;
}

module.exports = {getCiToken, validateGitHubActionsToken};
