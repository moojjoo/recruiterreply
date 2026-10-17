'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {mkdtempSync, mkdirSync, writeFileSync, rmSync} = require('node:fs');
const {tmpdir} = require('node:os');
const {join} = require('node:path');
const {identity, authorize, boundary, verifyArtifacts} = require('../private-dev-smoke.cjs');
const approved = {domain: 'approved-dev.auth.us-east-1.amazoncognito.com', clientId: 'devClient123'};
function response(location = '/_auth/login', status = 302) {
  return new Response(null, {status, headers: {location, 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow'}});
}
function authorization() {
  const url = new URL(`https://${approved.domain}/oauth2/authorize`);
  for (const [key, value] of Object.entries({client_id: approved.clientId, redirect_uri: 'https://dev.recruiterreply.com/_auth/callback', response_type: 'code', scope: 'openid email', code_challenge_method: 'S256', state: 's'.repeat(43), nonce: 'n'.repeat(43), code_challenge: 'c'.repeat(43)})) url.searchParams.set(key, value);
  return url;
}
test('identity must be explicitly configured', () => {
  assert.throws(() => identity({}));
  assert.deepEqual(identity({DEV_COGNITO_DOMAIN: approved.domain, DEV_COGNITO_CLIENT_ID: approved.clientId}), approved);
});
test('approved Cognito authorization redirect passes', () => authorize(response(authorization()), approved));
test('wrong identity, callback, protocol, OAuth flow, duplicate parameters and missing PKCE fail', () => {
  for (const mutate of [u => {u.hostname = 'other.auth.us-east-1.amazoncognito.com';}, u => {u.protocol = 'http:';}, u => {u.pathname = '/login';}, u => u.searchParams.set('client_id', 'testClient'), u => u.searchParams.set('redirect_uri', 'https://test.recruiterreply.com/_auth/callback'), u => u.searchParams.set('response_type', 'token'), u => u.searchParams.delete('code_challenge'), u => u.searchParams.delete('state'), u => u.searchParams.append('client_id', approved.clientId)]) {
    const url = authorization(); mutate(url);
    assert.throws(() => authorize(response(url), approved));
  }
});
test('boundary covers homepage, deep links, config and actual assets without following redirects', async () => {
  const seen = [];
  await boundary(approved, ['/assets/app.js'], async (url, options) => {
    assert.equal(options.redirect, 'manual'); seen.push(new URL(url).pathname);
    return response(url.endsWith('/_auth/login') ? authorization() : '/_auth/login');
  });
  for (const path of ['/', '/dashboard', '/config.js', '/assets/app.js', '/_auth/login']) assert.ok(seen.includes(path));
});
test('public homepage, denied outage and unexpected redirects fail', async () => {
  for (const result of [response('/_auth/login', 200), response('/_auth/login', 403), response('https://evil.example'), response('/other')]) {
    await assert.rejects(boundary(approved, [], async () => result));
  }
});
test('cacheable or indexable redirects fail', () => {
  for (const name of ['cache-control', 'x-robots-tag']) {
    const res = response(authorization()); res.headers.delete(name);
    assert.throws(() => authorize(res, approved));
  }
});
test('authenticated origin verification rejects missing or corrupted deployment files', () => {
  const root = mkdtempSync(join(tmpdir(), 'dev-smoke-test-'));
  const expected = join(root, 'expected'), deployed = join(root, 'deployed');
  try {
    for (const dir of [expected, deployed]) {
      mkdirSync(join(dir, 'assets'), {recursive: true});
      writeFileSync(join(dir, 'index.html'), '<div id="root" data-prerendered="react"><h1>Homepage</h1></div><script src="/assets/app.js"></script>');
      writeFileSync(join(dir, 'config.js'), 'window.API_BASE_URL="/api";');
      writeFileSync(join(dir, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
      writeFileSync(join(dir, 'assets/app.js'), 'application');
    }
    assert.deepEqual(verifyArtifacts(expected, deployed, '/api'), ['/assets/app.js']);
    assert.throws(() => verifyArtifacts(expected, deployed, 'https://wrong-api.example'), /API base URL/);
    writeFileSync(join(deployed, 'assets/app.js'), 'corrupted');
    assert.throws(() => verifyArtifacts(expected, deployed), /differs/);
    rmSync(join(deployed, 'assets/app.js'));
    assert.throws(() => verifyArtifacts(expected, deployed));
    rmSync(join(expected, 'index.html'));
    assert.throws(() => verifyArtifacts(expected, deployed), /Required frontend/);
  } finally { rmSync(root, {recursive: true, force: true}); }
});
