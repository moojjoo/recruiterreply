import { createSign } from 'node:crypto';
import { appendFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const SITE_ORIGIN = 'https://recruiterreply.com';
export const SITEMAP_URL = `${SITE_ORIGIN}/sitemap.xml`;
export const SEARCH_CONSOLE_SITE = 'sc-domain:recruiterreply.com';
export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
export const INDEXNOW_KEY = '6d51ad9dbfcb4a998ced7f38b7262e73';
export const INDEXNOW_KEY_LOCATION = `${SITE_ORIGIN}/${INDEXNOW_KEY}.txt`;
const MAX_BATCH_SIZE = 10_000;
const MAX_RETRIES = 3;
const MAX_RETRY_DELAY_MS = 8_000;
const REQUEST_TIMEOUT_MS = 15_000;

export function canonicalUrl(value) {
  const url = new URL(value);
  if (url.origin !== SITE_ORIGIN || url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error(`Non-canonical production URL: ${value}`);
  }
  if (url.pathname.includes('//') || url.pathname !== decodeURI(url.pathname)) {
    throw new Error(`Malformed canonical path: ${value}`);
  }
  return url.href;
}

export function parseSitemap(xml, { allowEmpty = false } = {}) {
  if (!/<urlset\b[^>]*xmlns=["']http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9["']/i.test(xml)) {
    throw new Error('Expected a sitemap urlset using the sitemap protocol namespace');
  }
  const urls = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) => canonicalUrl(match[1]));
  if (!urls.length && !allowEmpty) throw new Error('Sitemap contains no URLs');
  if (new Set(urls).size !== urls.length) throw new Error('Sitemap contains duplicate URLs');
  return urls;
}

export function changedUrls({ currentUrls, previousUrls = [], changedFiles = [] }) {
  const current = new Set(currentUrls.map(canonicalUrl));
  const previous = new Set(previousUrls.map(canonicalUrl));
  const result = new Set([...current].filter((url) => !previous.has(url)));
  for (const url of previous) if (!current.has(url)) result.add(url);

  const sharedFrontendChange = changedFiles.some((file) =>
    /^(frontend\/(src|index\.html|package(?:-lock)?\.json)|frontend\/scripts\/prerender\.mjs)/.test(file),
  );
  if (sharedFrontendChange) for (const url of current) result.add(url);

  for (const file of changedFiles) {
    const match = file.match(/^frontend\/public\/(.+?)(?:\/index)?\.html$/);
    if (!match) continue;
    const path = match[1] === 'index' ? '/' : `/${match[1]}`;
    const url = canonicalUrl(`${SITE_ORIGIN}${path}`);
    if (current.has(url) || previous.has(url)) result.add(url);
  }
  return [...result].sort();
}

export function indexNowPayload(urlList, key = INDEXNOW_KEY) {
  const urls = [...new Set(urlList.map(canonicalUrl))];
  if (!/^[a-zA-Z0-9-]{8,128}$/.test(key)) throw new Error('Invalid IndexNow key format');
  if (!urls.length || urls.length > MAX_BATCH_SIZE) throw new Error(`IndexNow batches must contain 1-${MAX_BATCH_SIZE} URLs`);
  return { host: new URL(SITE_ORIGIN).hostname, key, keyLocation: `${SITE_ORIGIN}/${key}.txt`, urlList: urls };
}

export async function requestWithRetry(url, options, {
  fetchImpl = fetch,
  retries = MAX_RETRIES,
  wait = setTimeout,
  requestTimeoutMs = REQUEST_TIMEOUT_MS,
} = {}) {
  for (let attempt = 0; ; attempt += 1) {
    let response;
    try {
      response = await fetchImpl(url, { ...options, signal: options.signal ?? AbortSignal.timeout(requestTimeoutMs) });
    } catch (error) {
      if (attempt >= retries) throw new Error(`Request failed after ${attempt + 1} attempts`, { cause: error });
      await new Promise((resolve) => wait(resolve, Math.min(1000 * 2 ** attempt, MAX_RETRY_DELAY_MS)));
      continue;
    }
    if (response.ok) return response;
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt >= retries) throw new Error(`Request failed with HTTP ${response.status}`);
    const retryAfter = Number(response.headers.get('retry-after'));
    const requestedDelay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt;
    const delay = Math.min(requestedDelay, MAX_RETRY_DELAY_MS);
    await new Promise((resolve) => wait(resolve, delay));
  }
}

export async function submitIndexNow(urls, options = {}) {
  const batches = [];
  for (let offset = 0; offset < urls.length; offset += MAX_BATCH_SIZE) batches.push(urls.slice(offset, offset + MAX_BATCH_SIZE));
  for (const batch of batches) {
    await requestWithRetry(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(indexNowPayload(batch)),
    }, options);
  }
  return { batches: batches.length, urls: urls.length };
}

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

export async function serviceAccountAccessToken(credentials, options = {}) {
  const { client_email: email, private_key: privateKey, token_uri: tokenUri = 'https://oauth2.googleapis.com/token' } = credentials;
  if (!email || !privateKey) throw new Error('Search Console service account requires client_email and private_key');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64url(JSON.stringify({
    iss: email,
    scope: 'https://www.googleapis.com/auth/webmasters',
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  }))}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  const assertion = `${unsigned}.${signer.sign(privateKey, 'base64url')}`;
  const response = await requestWithRetry(tokenUri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  }, options);
  const body = await response.json();
  if (!body.access_token) throw new Error('Google OAuth response did not contain an access token');
  return body.access_token;
}

export async function submitGoogleSitemap(credentials, options = {}) {
  const token = await serviceAccountAccessToken(credentials, options);
  const endpoint = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SEARCH_CONSOLE_SITE)}/sitemaps/${encodeURIComponent(SITEMAP_URL)}`;
  await requestWithRetry(endpoint, { method: 'PUT', headers: { authorization: `Bearer ${token}` } }, options);
}

export function assertProductionGate(environment, eventName) {
  if (environment !== 'prod' || eventName !== 'workflow_dispatch') {
    throw new Error('Search-engine submission is allowed only after a manually approved Production promotion');
  }
}

async function summary(lines) {
  const output = `${lines.join('\n')}\n`;
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, output);
  else process.stdout.write(output);
}

async function main() {
  assertProductionGate(process.env.DEPLOYMENT_ENVIRONMENT, process.env.GITHUB_EVENT_NAME);
  const currentXml = await readFile(process.env.CURRENT_SITEMAP || 'frontend/public/sitemap.xml', 'utf8');
  const previousXml = process.env.PREVIOUS_SITEMAP ? await readFile(process.env.PREVIOUS_SITEMAP, 'utf8') : '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><\/urlset>';
  const changedFiles = process.env.CHANGED_FILES ? (await readFile(process.env.CHANGED_FILES, 'utf8')).split(/\r?\n/).filter(Boolean) : [];
  const urls = changedUrls({ currentUrls: parseSitemap(currentXml), previousUrls: parseSitemap(previousXml, { allowEmpty: true }), changedFiles });
  const lines = ['## Search engine discovery', '', `Canonical sitemap: ${SITEMAP_URL}`, `Changed canonical URLs: ${urls.length}`];
  if (urls.length) {
    const indexNow = await submitIndexNow(urls);
    lines.push(`IndexNow accepted ${indexNow.urls} URL notifications in ${indexNow.batches} batch(es).`);
  } else lines.push('IndexNow skipped: no public canonical URL changes detected.');

  if (process.env.GOOGLE_SEARCH_CONSOLE_CREDENTIALS_JSON) {
    await submitGoogleSitemap(JSON.parse(process.env.GOOGLE_SEARCH_CONSOLE_CREDENTIALS_JSON));
    lines.push('Google Search Console accepted the sitemap submission request.');
  } else lines.push('Google Search Console skipped: owner service-account authorization is not configured.');
  lines.push('', '> Submission acceptance does not guarantee crawling or indexing.');
  await summary(lines);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(async (error) => {
    await summary(['## Search engine discovery', '', `Submission failed: ${error.message}`]);
    process.exitCode = 1;
  });
}
