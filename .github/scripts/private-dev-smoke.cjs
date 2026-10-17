#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const {createHash} = require('node:crypto');
const {mkdtempSync, readdirSync, readFileSync, rmSync} = require('node:fs');
const {tmpdir} = require('node:os');
const {join} = require('node:path');

const BASE = 'https://dev.recruiterreply.com';
function identity(env) {
  assert.match(env.DEV_COGNITO_DOMAIN || '', /^[a-z0-9-]+\.auth\.us-east-1\.amazoncognito\.com$/, 'Approved Dev Cognito domain is required');
  assert.match(env.DEV_COGNITO_CLIENT_ID || '', /^[A-Za-z0-9]+$/, 'Approved Dev Cognito client ID is required');
  assert.match(env.DEV_CLOUDFRONT_DOMAIN || '', /^[a-z0-9-]+\.cloudfront\.net$/, 'Approved Dev distribution hostname is required');
  return {domain: env.DEV_COGNITO_DOMAIN, clientId: env.DEV_COGNITO_CLIENT_ID, distributionDomain: env.DEV_CLOUDFRONT_DOMAIN};
}
function redirect(response) {
  assert.equal(response.status, 302, 'Anonymous Dev request must redirect to authentication');
  assert.match(response.headers.get('cache-control') || '', /\bno-store\b/i, 'Authentication redirect must not be cached');
  assert.match(response.headers.get('x-robots-tag') || '', /\bnoindex\b/i, 'Private Dev must be noindex');
}
function authorize(response, approved) {
  redirect(response);
  let url;
  try { url = new URL(response.headers.get('location')); } catch { throw new Error('Invalid Cognito authorization redirect'); }
  // Never include Location, cookies, state, or nonce in assertion messages.
  assert.ok(url.origin === `https://${approved.domain}` && url.pathname === '/oauth2/authorize' && !url.username && !url.password && !url.hash, 'Unexpected Cognito authorization destination');
  const expected = {client_id: approved.clientId, redirect_uri: `${BASE}/_auth/callback`, response_type: 'code', code_challenge_method: 'S256'};
  for (const [key, value] of Object.entries(expected)) {
    assert.ok(url.searchParams.getAll(key).length === 1 && url.searchParams.get(key) === value, 'Invalid OAuth ' + key);
  }
  for (const key of ['state', 'nonce', 'code_challenge']) {
    assert.ok(url.searchParams.getAll(key).length === 1 && /^[A-Za-z0-9_-]{32,}$/.test(url.searchParams.get(key) || ''), 'Missing or invalid OAuth ' + key);
  }
  assert.ok(url.searchParams.getAll('scope').length === 1 && url.searchParams.get('scope') === 'openid email', 'Unexpected OAuth scopes');
}
async function boundary(approved, paths = [], fetchRequest = fetch) {
  for (const path of new Set(['/', '/index.html', '/config.js', '/assets/__private_smoke_missing.js', '/dashboard', '/login', '/robots.txt', '/sitemap.xml', '/seo-recruiter-replies.html', ...paths])) {
    assert.ok(path.startsWith('/') && !path.startsWith('//'), 'Probe must stay on Dev');
    const response = await fetchRequest(BASE + path, {redirect: 'manual', signal: AbortSignal.timeout(15000)});
    try {
      redirect(response);
      assert.ok(response.headers.get('location') === '/_auth/login', 'Protected Dev route must redirect to the local login endpoint');
    } finally { await response.body?.cancel(); }
  }
  const response = await fetchRequest(BASE + '/_auth/login', {redirect: 'manual', signal: AbortSignal.timeout(15000)});
  try { authorize(response, approved); } finally { await response.body?.cancel(); }
  for (const path of ['/', '/index.html', '/config.js', '/dashboard']) {
    const response = await fetchRequest(`https://${approved.distributionDomain}${path}`, {redirect: 'manual', signal: AbortSignal.timeout(15000)});
    try {
      assert.equal(response.status, 403, 'Direct Dev distribution hostname must deny access');
      assert.match(response.headers.get('cache-control') || '', /\bno-store\b/i, 'Direct Dev denial must not be cached');
      assert.match(response.headers.get('x-robots-tag') || '', /\bnoindex\b/i, 'Direct Dev denial must be noindex');
    } finally { await response.body?.cancel(); }
  }
}
function authenticatedCredentials(env) {
  const token = env.DEV_SMOKE_OIDC_TOKEN || '';
  assert.ok(token.length <= 8192, 'Short-lived Dev smoke OIDC token is too large');
  assert.match(token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{20,8192}$/, 'Short-lived Dev smoke OIDC token is required');
  return {token};
}
async function authenticated(approved, env = process.env, fetchRequest = fetch) {
  const credentials = authenticatedCredentials(env);
  const request = async (path, headers = {}) => {
    const response = await fetchRequest(BASE + path, {
      redirect: 'manual',
      headers: {...headers, 'x-rr-ci-oidc-token': credentials.token},
      signal: AbortSignal.timeout(15000)
    });
    assert.equal(response.status, 200, `Authenticated Dev request failed for ${path}`);
    assert.ok(!response.headers.has('location'), `Authenticated Dev request redirected for ${path}`);
    return {response, body: await response.text()};
  };
  const homepage = await request('/');
  assert.match(homepage.response.headers.get('content-type') || '', /text\/html/i, 'Authenticated homepage must be HTML');
  assert.match(homepage.body, /<div id="root"[^>]*data-prerendered="react"[^>]*>/, 'Authenticated homepage must contain the prerendered React root');
  assert.match(homepage.body, /<h1\b/i, 'Authenticated homepage must contain a rendered H1');
  const assets = [...homepage.body.matchAll(/(?:src|href)=["'](\/assets\/[^"'?#]+)["']/g)].map(match => match[1]);
  assert.ok(assets.length > 0, 'Authenticated homepage must reference assets');
  for (const asset of new Set(assets)) await request(asset);
  await request('/dashboard');

  const apiUrl = env.DEV_SMOKE_API_URL || 'https://api-dev.recruiterreply.com/api/health/ci';
  const apiResponse = await fetchRequest(apiUrl, {
    redirect: 'manual',
    headers: {authorization: `Bearer ${credentials.token}`},
    signal: AbortSignal.timeout(15000)
  });
  try {
    assert.equal(apiResponse.status, 200, 'Authenticated Dev API health request failed');
    assert.ok(!apiResponse.headers.has('location'), 'Authenticated Dev API health request redirected');
  } finally { await apiResponse.body?.cancel(); }
  return {assetCount: new Set(assets).size, apiUrl: new URL(apiUrl).origin + new URL(apiUrl).pathname};
}
function files(directory, prefix = '') {
  return readdirSync(join(directory, prefix), {withFileTypes: true}).flatMap(entry => {
    const name = join(prefix, entry.name);
    assert.ok(!entry.isSymbolicLink(), 'Frontend artifacts cannot contain symlinks');
    return entry.isDirectory() ? files(directory, name) : [name];
  });
}
function verifyArtifacts(expected, deployed, apiBaseUrl) {
  const names = files(expected);
  for (const key of ['index.html', 'config.js', 'robots.txt']) assert.ok(names.includes(key), 'Required frontend file missing: ' + key);
  const html = readFileSync(join(expected, 'index.html'), 'utf8');
  assert.match(html, /<div id="root"[^>]*data-prerendered="react"[^>]*>/, 'Homepage must contain prerendered React root');
  assert.match(html, /<h1\b/i, 'Homepage must contain rendered H1');
  const assets = [...html.matchAll(/(?:src|href)=["'](\/assets\/[^"'?#]+)["']/g)].map(match => match[1]);
  assert.ok(assets.length > 0, 'Homepage must reference assets');
  for (const asset of assets) assert.ok(names.includes(asset.slice(1)), 'Referenced frontend asset is missing');
  const config = readFileSync(join(expected, 'config.js'), 'utf8');
  assert.doesNotMatch(config, /__RUNTIME_API_BASE_URL__/, 'Runtime config must be resolved');
  if (apiBaseUrl) assert.ok(config.includes(apiBaseUrl), 'Runtime API base URL must match the deployment');
  assert.match(readFileSync(join(expected, 'robots.txt'), 'utf8'), /^Disallow:\s*\/\s*$/m, 'Dev robots must disallow crawling');
  for (const name of names) {
    const hash = directory => createHash('sha256').update(readFileSync(join(directory, name))).digest('hex');
    assert.ok(hash(expected) === hash(deployed), 'Deployed frontend file differs from approved artifact: ' + name);
  }
  return assets;
}
async function main() {
  const approved = identity(process.env);
  let assets = [];
  if (!process.argv.includes('--boundary-only')) {
    const bucket = process.env.S3_FRONTEND_BUCKET;
    assert.match(bucket || '', /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/, 'Dev S3 bucket is required');
    const directory = mkdtempSync(join(tmpdir(), 'private-dev-smoke-'));
    try {
      // Authenticated reads only; keep the private origin private.
      execFileSync('aws', ['s3', 'sync', `s3://${bucket}`, directory, '--only-show-errors'], {stdio: 'pipe'});
      assert.ok(process.env.API_BASE_URL, 'Expected runtime API base URL is required');
      assets = verifyArtifacts('promoted-dist', directory, process.env.API_BASE_URL);
    } finally { rmSync(directory, {recursive: true, force: true}); }
  }
  await boundary(approved, assets);
  console.log('Private Dev smoke passed: anonymous boundary and approved Cognito redirect verified' + (assets.length ? '; uploaded frontend bytes verified through authenticated S3 reads' : ''));
}
if (require.main === module) main().then(async () => {
  if (process.argv.includes('--authenticated')) {
    const approved = identity(process.env);
    const result = await authenticated(approved);
    console.log(`Authenticated Dev smoke passed: assets=${result.assetCount}; API health verified`);
  }
}).catch(() => {
  // Fetch/AWS errors can contain response details. Do not log raw exceptions.
  console.error('Private Dev smoke failed: check approved identity configuration, private redirects, and deployed artifact integrity.');
  process.exitCode = 1;
});
module.exports = {identity, authorize, boundary, authenticatedCredentials, authenticated, verifyArtifacts};
