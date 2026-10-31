#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const {mkdtempSync, rmSync} = require('node:fs');
const {tmpdir} = require('node:os');
const {join} = require('node:path');
const {verifyArtifacts} = require('./private-dev-smoke.cjs');

const BASE = 'https://test.recruiterreply.com';
const ORIGIN = 'https://api-test.recruiterreply.com';
function identity(env) {
  assert.match(env.TEST_COGNITO_DOMAIN || '', /^[a-z0-9-]+\.auth\.us-east-1\.amazoncognito\.com$/, 'Approved Test Cognito domain is required');
  assert.match(env.TEST_COGNITO_CLIENT_ID || '', /^[A-Za-z0-9]+$/, 'Approved Test Cognito client ID is required');
  assert.match(env.TEST_CLOUDFRONT_DOMAIN || '', /^[a-z0-9]+\.cloudfront\.net$/, 'Approved Test distribution hostname is required');
  return {domain: env.TEST_COGNITO_DOMAIN, clientId: env.TEST_COGNITO_CLIENT_ID, distributionDomain: env.TEST_CLOUDFRONT_DOMAIN};
}
function privateHeaders(response) {
  assert.match(response.headers.get('cache-control') || '', /\bno-store\b/i, 'Authentication response must not be cached');
  assert.match(response.headers.get('x-robots-tag') || '', /\bnoindex\b/i, 'Private Test must be noindex');
}
function authorize(response, approved) {
  assert.equal(response.status, 302, 'Test login must redirect to Cognito');
  privateHeaders(response);
  let url;
  try { url = new URL(response.headers.get('location')); } catch { throw new Error('Invalid authorization redirect'); }
  // Assertions must never disclose OAuth parameters or cookies.
  assert.ok(url.origin === `https://${approved.domain}` && url.pathname === '/oauth2/authorize' && !url.username && !url.password && !url.hash, 'Unexpected Cognito authorization destination');
  for (const [key, value] of Object.entries({client_id: approved.clientId, redirect_uri: `${BASE}/_auth/callback`, response_type: 'code', code_challenge_method: 'S256', scope: 'openid email'})) {
    assert.ok(url.searchParams.getAll(key).length === 1 && url.searchParams.get(key) === value, 'Invalid OAuth ' + key);
  }
  for (const key of ['state', 'nonce', 'code_challenge']) {
    assert.ok(url.searchParams.getAll(key).length === 1 && /^[A-Za-z0-9_-]{32,}$/.test(url.searchParams.get(key) || ''), 'Missing or invalid OAuth ' + key);
  }
}
async function boundary(approved, paths = [], fetchRequest = fetch) {
  const probe = async (url, check, headers) => {
    const response = await fetchRequest(url, {redirect: 'manual', headers, signal: AbortSignal.timeout(15000)});
    try { check(response); } finally { await response.body?.cancel(); }
  };
  const protectedResponse = response => {
    assert.equal(response.status, 302, 'Anonymous Test request must redirect');
    privateHeaders(response);
    assert.ok(response.headers.get('location') === '/_auth/login', 'Test must redirect to its local login endpoint');
  };
  for (const path of new Set(['/', '/index.html', '/config.js', '/assets/__private_smoke_missing.js', '/dashboard', '/login', '/robots.txt', '/sitemap.xml', '/seo-recruiter-replies.html', '/api/health', ...paths])) {
    assert.ok(path.startsWith('/') && !path.startsWith('//'), 'Probe must stay on Test');
    await probe(BASE + path, protectedResponse);
  }
  await probe(BASE + '/api/health', protectedResponse, {cookie: 'rr_session=invalid', 'x-rr-origin-auth': 'invalid'});
  await probe(BASE + '/_auth/login', response => authorize(response, approved));
  for (const path of ['/', '/config.js', '/dashboard', '/api/health']) {
    await probe(`https://${approved.distributionDomain}` + path, response => {
      assert.equal(response.status, 403, 'Distribution hostname must reject bypass');
      privateHeaders(response);
    });
  }
  await probe(ORIGIN + '/api/health', response => assert.equal(response.status, 403, 'Direct Test API origin must reject anonymous access'));
}
async function main() {
  const approved = identity(process.env);
  let assets = [];
  if (!process.argv.includes('--boundary-only')) {
    assert.equal(process.env.API_BASE_URL, '/api', 'Test must use its same-origin API');
    const bucket = process.env.S3_FRONTEND_BUCKET;
    assert.equal(bucket, 'recruiterreply-test-frontend-178522450316', 'Approved Test bucket is required');
    const directory = mkdtempSync(join(tmpdir(), 'private-test-smoke-'));
    try {
      execFileSync('aws', ['s3', 'sync', `s3://${bucket}`, directory, '--only-show-errors'], {stdio: 'pipe'});
      assets = verifyArtifacts('promoted-dist', directory, '/api');
    } finally { rmSync(directory, {recursive: true, force: true}); }
  }
  await boundary(approved, assets);
  process.stdout.write('Private Test smoke passed: anonymous perimeter, Test Cognito redirect, and direct-origin denial verified' + (assets.length ? '; frontend artifact bytes verified through authenticated S3 reads' : '') + '\n');
}
if (require.main === module) main().catch(() => {
  process.stderr.write('Private Test smoke failed: check Test identity, private redirects, direct-origin denial, and artifact integrity.\n');
  process.exitCode = 1;
});
module.exports = {identity, authorize, boundary};
