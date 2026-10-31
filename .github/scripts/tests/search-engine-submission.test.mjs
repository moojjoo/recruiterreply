import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  assertProductionGate,
  changedUrls,
  indexNowPayload,
  parseSitemap,
  requestWithRetry,
  serviceAccountAccessToken,
  SITE_ORIGIN,
} from '../search-engine-submission.mjs';

const sitemap = (urls) => `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<url><loc>${url}</loc></url>`).join('')}</urlset>`;

test('sitemap parsing accepts unique production canonical URLs only', () => {
  assert.deepEqual(parseSitemap(sitemap([`${SITE_ORIGIN}/`, `${SITE_ORIGIN}/pricing`])), [`${SITE_ORIGIN}/`, `${SITE_ORIGIN}/pricing`]);
  assert.throws(() => parseSitemap(sitemap(['https://dev.recruiterreply.com/'])), /Non-canonical/);
  assert.throws(() => parseSitemap(sitemap([`${SITE_ORIGIN}/`, `${SITE_ORIGIN}/`])), /duplicate/);
  assert.throws(() => parseSitemap('<html></html>'), /urlset/);
});

test('change detection includes additions, deletions, route files, and shared frontend changes', () => {
  const home = `${SITE_ORIGIN}/`;
  const pricing = `${SITE_ORIGIN}/pricing`;
  const removed = `${SITE_ORIGIN}/old`;
  assert.deepEqual(changedUrls({ currentUrls: [home, pricing], previousUrls: [home, removed] }), [removed, pricing]);
  assert.deepEqual(changedUrls({ currentUrls: [home, pricing], previousUrls: [home, pricing], changedFiles: ['frontend/src/App.tsx'] }), [home, pricing]);
  assert.deepEqual(changedUrls({ currentUrls: [home, pricing], previousUrls: [home, pricing], changedFiles: ['frontend/public/pricing.html'] }), [pricing]);
});

test('IndexNow payload is deduplicated and contains public proof location', () => {
  const payload = indexNowPayload([`${SITE_ORIGIN}/`, `${SITE_ORIGIN}/`]);
  assert.equal(payload.urlList.length, 1);
  assert.equal(payload.keyLocation, `${SITE_ORIGIN}/${payload.key}.txt`);
  assert.throws(() => indexNowPayload(['https://test.recruiterreply.com/']), /Non-canonical/);
});

test('retry is bounded and honors retryable status only', async () => {
  let calls = 0;
  const delays = [];
  const response = await requestWithRetry('https://example.invalid', {}, {
    fetchImpl: async (_url, request) => {
      assert.ok(request.signal, 'each request has a timeout signal');
      return new Response('', { status: ++calls < 3 ? 503 : 200, headers: { 'retry-after': '86400' } });
    },
    retries: 2,
    wait: (resolve, delay) => { delays.push(delay); resolve(); },
  });
  assert.equal(response.status, 200);
  assert.equal(calls, 3);
  assert.deepEqual(delays, [8000, 8000], 'Retry-After cannot exceed the bounded backoff');
  await assert.rejects(() => requestWithRetry('https://example.invalid', {}, { fetchImpl: async () => new Response('', { status: 401 }) }), /401/);
});

test('network failures retry only to the configured limit', async () => {
  let calls = 0;
  await assert.rejects(() => requestWithRetry('https://example.invalid', {}, {
    fetchImpl: async () => { calls += 1; throw new Error('socket stalled'); },
    retries: 1,
    wait: (resolve) => resolve(),
    requestTimeoutMs: 5,
  }), /2 attempts/);
  assert.equal(calls, 2);
});

test('environment gate rejects Dev, Test, and non-manual runs', () => {
  assert.doesNotThrow(() => assertProductionGate('prod', 'workflow_dispatch'));
  for (const env of ['dev', 'test']) assert.throws(() => assertProductionGate(env, 'workflow_dispatch'), /Production/);
  assert.throws(() => assertProductionGate('prod', 'push'), /Production/);
});

test('workflow runs discovery only after the Production promotion succeeds', async () => {
  const workflow = await readFile(new URL('../../workflows/promote-prod.yml', import.meta.url), 'utf8');
  assert.match(workflow, /search-engine-discovery:\n\s+needs: \[resolve-source, promote\]/);
  assert.match(workflow, /environment: prod/);
  assert.match(workflow, /DEPLOYMENT_ENVIRONMENT: prod/);
  assert.doesNotMatch(workflow, /environment: (?:dev|test)[\s\S]*search-engine-submission/);
});

test('Search Console uses supported OAuth service-account exchange and rejects auth failures', async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const credentials = { client_email: 'search-console@example.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
  const token = await serviceAccountAccessToken(credentials, { fetchImpl: async (_url, request) => {
    assert.match(String(request.body), /jwt-bearer/);
    return Response.json({ access_token: 'masked-token' });
  }});
  assert.equal(token, 'masked-token');
  await assert.rejects(() => serviceAccountAccessToken(credentials, { fetchImpl: async () => new Response('', { status: 401 }) }), /401/);
});
