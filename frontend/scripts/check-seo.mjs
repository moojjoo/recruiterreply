import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const sitemap = readFileSync(new URL('../dist/sitemap.xml', import.meta.url), 'utf8');
const title = html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? '';
assert.match(title, /RecruiterReply/);
assert.match(title, /AI Recruiter Reply/);
assert.equal((html.match(/<link rel="canonical"/g) ?? []).length, 1, 'one canonical URL');
assert.match(html, /<meta\s+name="description"/i);
assert.match(html, /<meta property="og:title"/);
const root = html.match(/<div id="root"[^>]*>([\\s\\S]*?)<\\/div>/i)?.[1] ?? '';
assert.match(root, /<h1\\b[^>]*>[\\s\\S]*?<\\/h1>/i, 'homepage must render H1 in raw HTML');
assert.match(root, /recruiter|job search/i, 'homepage must render meaningful copy in raw HTML');
assert.match(root, /<a\\s+[^>]*href=/i, 'homepage must render navigable links in raw HTML');
assert.equal((root.match(/<h1\\b/gi) ?? []).length, 1, 'one homepage H1');

const jsonLd = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
assert.ok(jsonLd.some(obj => obj['@type'] === 'SoftwareApplication'), 'SoftwareApplication schema');
assert.ok(jsonLd.some(obj => obj['@graph']?.some(node => node['@type'] === 'Organization')), 'Organization schema');
assert.ok(jsonLd.some(obj => obj['@graph']?.some(node => node['@type'] === 'WebSite')), 'WebSite schema');
assert.ok(!/https:\/\/recruiterreply\.com\/(login|register|dashboard|profile)</.test(sitemap), 'no auth pages in sitemap');
console.log('SEO metadata and sitemap checks passed');

for (const slug of ['seo-recruiter-replies', 'seo-job-offer-comparison']) {
  const page = readFileSync(new URL(`../dist/${slug}.html`, import.meta.url), 'utf8');
  assert.match(page, /<h1>[^<]+<\/h1>/i, `${slug} has a readable H1`);
  assert.match(page, /<meta name="description" content="[^"]+"/i, `${slug} has description`);
  assert.match(page, new RegExp(`<link rel="canonical" href="https://recruiterreply.com/${slug}\\.html"`));
  assert.match(sitemap, new RegExp(`https://recruiterreply.com/${slug}\\.html`));
}
console.log('Static landing page SEO checks passed');
