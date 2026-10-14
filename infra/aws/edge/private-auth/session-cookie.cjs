'use strict';

const crypto = require('node:crypto');

const COOKIE_NAME = 'rr_session';
const SESSION_TTL_SECONDS = 900;

function sign(payload, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');
}

function safeEqual(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  return left.length === right.length &&
    crypto.timingSafeEqual(left, right);
}

function createSessionCookie({ subject, issuer, clientId }, secret, now = Date.now()) {
  if (
    typeof secret !== 'string' ||
    Buffer.byteLength(secret) < 32 ||
    typeof subject !== 'string' ||
    !subject ||
    typeof issuer !== 'string' ||
    typeof clientId !== 'string'
  ) {
    throw new Error('Invalid session configuration');
  }

  const payload = Buffer.from(JSON.stringify({
    sub: subject,
    iss: issuer,
    aud: clientId,
    iat: Math.floor(now / 1000),
    exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS,
    jti: crypto.randomBytes(16).toString('base64url')
  })).toString('base64url');

  const value = `${payload}.${sign(payload, secret)}`;

  return {
    name: COOKIE_NAME,
    value,
    header: `${COOKIE_NAME}=${value}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; Secure; HttpOnly; SameSite=Lax`
  };
}

function verifySessionCookie(value, secret, expected, now = Date.now()) {
  if (
    typeof secret !== 'string' ||
    Buffer.byteLength(secret) < 32 ||
    typeof value !== 'string' ||
    value.length > 4096 ||
    !expected ||
    typeof expected.issuer !== 'string' ||
    typeof expected.clientId !== 'string'
  ) {
    throw new Error('Invalid session');
  }

  const parts = value.split('.');
  if (parts.length !== 2) throw new Error('Invalid session');

  const [payload, signature] = parts;

  if (!safeEqual(signature, sign(payload, secret))) {
    throw new Error('Invalid session signature');
  }

  let claims;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Invalid session payload');
  }

  const nowSeconds = Math.floor(now / 1000);

  if (
    typeof claims.sub !== 'string' ||
    !claims.sub ||
    claims.iss !== expected.issuer ||
    claims.aud !== expected.clientId ||
    !Number.isInteger(claims.iat) ||
    !Number.isInteger(claims.exp) ||
    claims.iat > nowSeconds ||
    claims.exp <= nowSeconds ||
    claims.exp - claims.iat > SESSION_TTL_SECONDS ||
    typeof claims.jti !== 'string'
  ) {
    throw new Error('Expired or invalid session');
  }

  return claims;
}

function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax`;
}

module.exports = {
  createSessionCookie,
  verifySessionCookie,
  clearSessionCookie
};
