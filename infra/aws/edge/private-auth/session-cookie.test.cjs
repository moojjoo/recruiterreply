'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  createSessionCookie,
  verifySessionCookie,
  clearSessionCookie
} = require('./session-cookie.cjs');

const secret = 'test-only-session-secret-at-least-32-bytes';
const now = 1800000000000;

const dev = {
  subject: 'dev-user',
  issuer: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_DEV',
  clientId: 'dev-client',
  email: 'tester@example.com',
  emailVerified: true,
  firstName: 'Dev',
  lastName: 'Tester'
};

const devExpected = {
  issuer: dev.issuer,
  clientId: dev.clientId
};

test('session cookie has secure attributes and short lifetime', () => {
  const cookie = createSessionCookie(dev, secret, now);
  assert.match(cookie.header, /^rr_session=/);
  assert.match(cookie.header, /; Secure/);
  assert.match(cookie.header, /; HttpOnly/);
  assert.match(cookie.header, /; SameSite=Lax/);
  assert.match(cookie.header, /; Max-Age=900/);
});

test('valid session cookie round-trips', () => {
  const cookie = createSessionCookie(dev, secret, now);
  const claims = verifySessionCookie(cookie.value, secret, devExpected, now + 1000);
  assert.equal(claims.sub, dev.subject);
  assert.equal(claims.iss, dev.issuer);
  assert.equal(claims.aud, dev.clientId);
  assert.equal(claims.email, dev.email);
  assert.equal(claims.emailVerified, true);
});

test('tampered session cookie is rejected', () => {
  const cookie = createSessionCookie(dev, secret, now);
  const tampered = `${cookie.value.slice(0, -1)}x`;
  assert.throws(() => verifySessionCookie(tampered, secret, devExpected, now + 1000));
});

test('expired session cookie is rejected', () => {
  const cookie = createSessionCookie(dev, secret, now);
  assert.throws(
    () => verifySessionCookie(cookie.value, secret, devExpected, now + 900001),
    /Expired or invalid session/
  );
});

test('Dev session cannot authenticate against Test identity', () => {
  const cookie = createSessionCookie(dev, secret, now);
  assert.throws(
    () => verifySessionCookie(cookie.value, secret, {
      issuer: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_TEST',
      clientId: 'test-client'
    }, now + 1000),
    /Expired or invalid session/
  );
});

test('weak session signing secrets are rejected', () => {
  assert.throws(() => createSessionCookie(dev, 'short', now), /Invalid session configuration/);
});

test('session cookie can be cleared securely', () => {
  const header = clearSessionCookie();
  assert.match(header, /^rr_session=;/);
  assert.match(header, /; Max-Age=0/);
  assert.match(header, /; Secure/);
  assert.match(header, /; HttpOnly/);
  assert.match(header, /; SameSite=Lax/);
});
