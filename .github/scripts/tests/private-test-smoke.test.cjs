'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {identity, authorize, boundary} = require('../private-test-smoke.cjs');
const approved = {domain: 'approved-test.auth.us-east-1.amazoncognito.com', clientId: 'testClient123', distributionDomain: 'testfixture.cloudfront.net'};
function response(location = '/_auth/login', status = 302) {
  return new Response(null, {status, headers: {location, 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow'}});
}
function authorization() {
  const url = new URL(`https://${approved.domain}/oauth2/authorize`);
  for (const [key, value] of Object.entries({client_id: approved.clientId, redirect_uri: 'https://test.recruiterreply.com/_auth/callback', response_type: 'code', scope: 'openid email', code_challenge_method: 'S256', state: 's'.repeat(43), nonce: 'n'.repeat(43), code_challenge: 'c'.repeat(43)})) url.searchParams.set(key, value);
  return url;
}
test('Test requires independently configured Cognito identity', () => {
  assert.throws(() => identity({DEV_COGNITO_DOMAIN: approved.domain, DEV_COGNITO_CLIENT_ID: approved.clientId}));
  assert.throws(() => identity({TEST_COGNITO_DOMAIN: approved.domain, TEST_COGNITO_CLIENT_ID: approved.clientId}));
  assert.deepEqual(identity({TEST_COGNITO_DOMAIN: approved.domain, TEST_COGNITO_CLIENT_ID: approved.clientId, TEST_CLOUDFRONT_DOMAIN: approved.distributionDomain}), approved);
});
test('Test accepts only the approved Cognito client, callback and PKCE flow', () => {
  authorize(response(authorization()), approved);
  for (const mutate of [u => {u.hostname = 'other.auth.us-east-1.amazoncognito.com';}, u => {u.protocol = 'http:';}, u => u.searchParams.set('client_id', 'devClient'), u => u.searchParams.set('redirect_uri', 'https://dev.recruiterreply.com/_auth/callback'), u => u.searchParams.set('response_type', 'token'), u => u.searchParams.delete('code_challenge'), u => u.searchParams.delete('state'), u => u.searchParams.append('client_id', approved.clientId)]) {
    const url = authorization(); mutate(url);
    assert.throws(() => authorize(response(url), approved));
  }
});
test('Test probes pages, assets, API, forged cookies, distribution and direct origin without following redirects', async () => {
  const seen = [];
  await boundary(approved, ['/assets/app.js'], async (url, options) => {
    assert.equal(options.redirect, 'manual'); seen.push({url, options});
    if (new URL(url).hostname !== 'test.recruiterreply.com') return response('', 403);
    return response(url.endsWith('/_auth/login') ? authorization() : '/_auth/login');
  });
  for (const path of ['/', '/dashboard', '/config.js', '/assets/app.js', '/api/health', '/_auth/login']) assert.ok(seen.some(x => x.url === 'https://test.recruiterreply.com' + path));
  assert.ok(seen.some(x => x.options.headers?.cookie === 'rr_session=invalid'));
  assert.ok(seen.some(x => x.url === 'https://api-test.recruiterreply.com/api/health'));
});
test('public content, outages, wrong redirects and origin bypass fail Test verification', async () => {
  for (const result of [response('', 200), response('', 403), response('https://evil.example'), response('/other')]) {
    await assert.rejects(boundary(approved, [], async () => result));
  }
  for (const bypass of [approved.distributionDomain, 'api-test.recruiterreply.com']) {
    await assert.rejects(boundary(approved, [], async url => {
      if (new URL(url).hostname === bypass) return response('', 200);
      if (new URL(url).hostname !== 'test.recruiterreply.com') return response('', 403);
      return response(url.endsWith('/_auth/login') ? authorization() : '/_auth/login');
    }));
  }
});
test('cacheable or indexable authentication redirects fail', () => {
  for (const name of ['cache-control', 'x-robots-tag']) {
    const res = response(authorization()); res.headers.delete(name);
    assert.throws(() => authorize(res, approved));
  }
});
