'use strict';

const crypto = require('node:crypto');
const {seal, open} = require('./sealed-cookie.cjs');

const COOKIE_NAME = 'rr_session';
const SESSION_TTL_SECONDS = 900;

function createSessionCookie({ subject, issuer, clientId, email, emailVerified, firstName, lastName }, secret, now = Date.now()) {
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

  const payload = JSON.stringify({
    sub: subject,
    iss: issuer,
    aud: clientId,
    iat: Math.floor(now / 1000),
    exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS,
    jti: crypto.randomBytes(16).toString('base64url'),
    email: typeof email === 'string' ? email : undefined,
    emailVerified: emailVerified === true,
    firstName: typeof firstName === 'string' ? firstName : undefined,
    lastName: typeof lastName === 'string' ? lastName : undefined
  });
  const value = seal(payload, secret, COOKIE_NAME);

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

  let claims;
  try {
    claims = JSON.parse(open(value, secret, COOKIE_NAME));
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
