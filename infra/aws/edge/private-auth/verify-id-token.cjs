'use strict';

// Pure verification primitives shared by the future Lambda@Edge viewer-request gate.
// This module is NOT deployed or associated with CloudFront by itself.
const crypto = require('node:crypto');

function parseJsonSegment(segment) {
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) throw new Error('Malformed JWT segment');
  const raw = Buffer.from(segment, 'base64url');
  if (raw.length > 16384) throw new Error('JWT segment too large');
  return JSON.parse(raw.toString('utf8'));
}

function validateIdToken(token, jwks, config, now = Math.floor(Date.now() / 1000)) {
  if (typeof token !== 'string' || token.length > 16000) throw new Error('Invalid JWT');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');
  const header = parseJsonSegment(parts[0]);
  const claims = parseJsonSegment(parts[1]);
  if (header.alg !== 'RS256' || header.typ && header.typ !== 'JWT') throw new Error('Unsupported JWT algorithm');
  if (typeof header.kid !== 'string' || !header.kid || header.kid.length > 256) throw new Error('Missing key ID');
  if (!config || typeof config.issuer !== 'string' || typeof config.clientId !== 'string') throw new Error('Missing verifier configuration');
  if (claims.iss !== config.issuer || claims.aud !== config.clientId || claims.token_use !== 'id') throw new Error('Wrong token issuer, audience or use');
  if (!Number.isInteger(claims.exp) || claims.exp <= now) throw new Error('Expired token');
  if (!Number.isInteger(claims.iat) || claims.iat > now + 60 || claims.iat < now - 86400) throw new Error('Invalid issuance time');
  if (claims.nbf !== undefined && (!Number.isInteger(claims.nbf) || claims.nbf > now)) throw new Error('Token not yet valid');
  if (claims.email_verified !== true && claims.email_verified !== 'true') throw new Error('Unverified email');
  if (typeof claims.sub !== 'string' || !claims.sub) throw new Error('Missing subject');
  if (!jwks || !Array.isArray(jwks.keys)) throw new Error('Invalid JWKS');
  const matches = jwks.keys.filter(key => key.kid === header.kid && key.kty === 'RSA' && key.use === 'sig' && key.alg === 'RS256');
  if (matches.length !== 1) throw new Error('Unknown or ambiguous signing key');
  const key = crypto.createPublicKey({key: matches[0], format: 'jwk'});
  if (!/^[A-Za-z0-9_-]+$/.test(parts[2])) {
    throw new Error('Malformed JWT signature');
  }
  const signature = Buffer.from(parts[2], 'base64url');
  if (!crypto.verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), key, signature)) throw new Error('Invalid token signature');
  return claims;
}

module.exports = {validateIdToken};
