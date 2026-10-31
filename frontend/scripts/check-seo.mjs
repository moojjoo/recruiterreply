import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const dist = new URL('../dist/', import.meta.url);
const siteUrl = 'https://recruiterreply.com';
const publicPaths = [
  '/', '/pricing', '/policy', '/terms', '/cookies',
  '/guides/how-to-reply-to-a-recruiter',
  '/guides/compare-job-offers',
  '/guides/salary-negotiation-email',
];
const authPaths = ['/login', '/register', '/forgot-password', '/reset-password'];
const guidePaths = publicPaths.filter((path) => path.startsWith('/guides/'));

const fileFor = (path) => new URL(path === '/' ? 'index.html' : `${path.slice(1)}/index.html`, dist);
const htmlFor = (path) => readFileSync(fileFor(path), 'utf8');
const canonicalFor = (path) => path === '/' ? `${siteUrl}/` : `${siteUrl}${path}`;
const rootFor = (html) => html.slice(html.indexOf('<div id="root"'), html.indexOf('</body>'));

function textWordCount(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:[a-z]+|#\d+);/gi, ' ')
    .trim().split(/\s+/).filter(Boolean).length;
}

const home = htmlFor('/');
assert.match(home.slice(0, 300), /<meta\s+charset=["']?utf-8["']?\s*\/?\s*>/i, 'UTF-8 declaration must appear early');
const homeRoot = rootFor(home);
assert.match(homeRoot, /data-prerendered="react"/, 'React prerender marker required');
assert.equal((homeRoot.match(/<h1\b/gi) ?? []).length, 1, 'homepage has one H1');
for (const label of ['Get Started Now', 'Learn More', 'Start Your Free Analysis', 'Sign Up']) {
  assert.match(homeRoot, new RegExp(`<a\\s+[^>]*href=["'][^"']+["'][^>]*>[\\s\\S]{0,120}${label}`, 'i'), `${label} is a crawlable anchor`);
}

const titles = new Set();
const sitemap = readFileSync(new URL('sitemap.xml', dist), 'utf8');
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
assert.deepEqual(sitemapUrls.sort(), publicPaths.map(canonicalFor).sort(), 'sitemap exactly matches indexable public routes');

for (const path of publicPaths) {
  const html = htmlFor(path);
  const root = rootFor(html);
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? '';
  assert.ok(title, `${path} has a title`);
  assert.ok(!titles.has(title), `${path} has a unique title`);
  titles.add(title);
  assert.match(root, /<h1\b[^>]*>[\s\S]*?<\/h1>/i, `${path} has a prerendered H1`);
  assert.equal((html.match(/<link rel="canonical"/g) ?? []).length, 1, `${path} has one canonical`);
  assert.ok(html.includes(`<link rel="canonical" href="${canonicalFor(path)}"`), `${path} canonical is self-referencing`);
  assert.match(html, /<meta name="robots" content="index, follow"/i, `${path} is indexable`);
  assert.match(html, /<meta property="og:image" content="https:\/\/recruiterreply\.com\/og-image\.png"/i, `${path} uses PNG social image`);
  assert.match(html, /<meta property="og:image:width" content="1200"/i, `${path} declares social image width`);
  assert.match(html, /<meta property="og:image:height" content="630"/i, `${path} declares social image height`);
}

for (const path of authPaths) {
  const html = htmlFor(path);
  assert.match(html, /<meta name="robots" content="noindex, nofollow"/i, `${path} is noindex`);
  assert.ok(!sitemap.includes(canonicalFor(path)), `${path} is absent from sitemap`);
}

for (const path of guidePaths) {
  const html = htmlFor(path);
  assert.ok(textWordCount(rootFor(html)) >= 800, `${path} contains at least 800 words`);
  const structured = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1]));
  assert.ok(structured.some((item) => item['@type'] === 'Article'), `${path} has Article JSON-LD`);
  assert.ok(structured.some((item) => item['@type'] === 'BreadcrumbList'), `${path} has BreadcrumbList JSON-LD`);
}

const image = readFileSync(new URL('og-image.png', dist));
assert.equal(image.toString('ascii', 1, 4), 'PNG', 'social image is PNG');
assert.equal(image.readUInt32BE(16), 1200, 'social image width is 1200');
assert.equal(image.readUInt32BE(20), 630, 'social image height is 630');

const homepageStructured = [...home.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1]));
assert.ok(homepageStructured.some((item) => item['@type'] === 'SoftwareApplication'), 'homepage has SoftwareApplication schema');
assert.ok(!JSON.stringify(homepageStructured).includes('Recruiters'), 'structured data targets job seekers only');

const llms = readFileSync(new URL('llms.txt', dist), 'utf8');
assert.match(llms, /^# RecruiterReply\s*$/m, 'llms.txt has a heading');
for (const path of guidePaths) assert.ok(llms.includes(canonicalFor(path)), `llms.txt links ${path}`);
const catalog = JSON.parse(readFileSync(new URL('ai-catalog.json', dist), 'utf8'));
assert.deepEqual(catalog.publicPages.sort(), guidePaths.map(canonicalFor).sort(), 'AI catalog links canonical guides');

const entryBundles = readdirSync(new URL('assets/', dist)).filter((name) => /^index-.*\.js$/.test(name));
assert.equal(entryBundles.length, 1, 'one initial JavaScript entry bundle');
const entryBytes = readFileSync(new URL(`assets/${entryBundles[0]}`, dist)).byteLength;
assert.ok(entryBytes <= 350 * 1024, `initial JavaScript bundle stays within 350 KiB budget (actual ${entryBytes} bytes)`);

console.log('Route metadata, prerendering, guides, social image, sitemap, and bundle budget checks passed');
