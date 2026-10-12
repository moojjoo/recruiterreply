import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
assert.match(html.slice(0, 300), /<meta\s+charset=["']?utf-8["']?\s*\/?\s*>/i, 'UTF-8 declaration must appear early in raw HTML');
const llms = readFileSync(new URL('../dist/llms.txt', import.meta.url), 'utf8');
assert.match(llms, /^# RecruiterReply\s*$/m, 'llms.txt must have a heading');
assert.match(llms, /https:\/\/recruiterreply\.com\/seo-recruiter-replies\.html/, 'llms.txt links public canonical page');
const catalog = JSON.parse(readFileSync(new URL('../dist/ai-catalog.json', import.meta.url), 'utf8'));
assert.equal(catalog.name, 'RecruiterReply', 'AI catalog must be valid JSON');
assert.match(JSON.stringify(catalog), /https:\/\/recruiterreply\.com\//, 'AI catalog uses canonical host');
const layoutSource = readFileSync(new URL('../src/components/layout/MainLayout.tsx', import.meta.url), 'utf8');
assert.ok(!layoutSource.includes('text-primary-600 hover:underline'), 'footer links must use high-contrast class');
const sitemap = readFileSync(new URL('../dist/sitemap.xml', import.meta.url), 'utf8');

const robots = readFileSync(new URL('../dist/robots.txt', import.meta.url), 'utf8');
assert.match(robots, /^User-agent:\s*\*/mi, 'robots has crawler policy');
assert.match(robots, /^Sitemap:\s*https:\/\/recruiterreply\.com\/sitemap\.xml\s*$/mi, 'robots links canonical sitemap');
assert.ok(!/<html\b/i.test(sitemap), 'sitemap must be XML, not SPA fallback');
const urls = [...sitemap.matchAll(new RegExp('<loc>([^<]+)</loc>', 'g'))].map(m => m[1]);
assert.ok(urls.length > 0, 'sitemap must contain canonical public pages');
assert.equal(new Set(urls).size, urls.length, 'sitemap URLs must be unique');
for (const url of urls) {
  assert.ok(url.startsWith('https://recruiterreply.com/'), 'sitemap contains only canonical host: ' + url);
  assert.ok(!new RegExp('/(?:login|register|forgot-password|reset-password|dashboard|analyze|reply|compare|profile|opportunities|career-profile|recruiter-inbox)(?:[/?#]|$)', 'i').test(url), 'sitemap excludes private/auth routes: ' + url);
}

const title = html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? '';
assert.match(title, /RecruiterReply/);
assert.match(title, /AI Recruiter Reply/);
assert.equal((html.match(/<link rel="canonical"/g) ?? []).length, 1, 'one canonical URL');
assert.match(html, /<meta\s+name="description"/i);
assert.match(html, /<meta property="og:title"/);
const root = html.slice(html.indexOf('<div id="root"'), html.indexOf('</body>'));
assert.match(root, /data-prerendered="react"/, 'React prerender marker required');
assert.match(root, /<h1\b[^>]*>[\s\S]*?<\/h1>/i, 'homepage must render H1 in raw HTML');
assert.match(root, /recruiter|job search/i, 'homepage must render meaningful copy in raw HTML');
assert.match(root, /<a\s+[^>]*href=/i, 'homepage must render navigable links in raw HTML');
assert.equal((root.match(/<h1\b/gi) ?? []).length, 1, 'one homepage H1');

const jsonLd = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
assert.ok(jsonLd.some(obj => obj['@type'] === 'SoftwareApplication'), 'SoftwareApplication schema');
assert.ok(jsonLd.some(obj => obj['@graph']?.some(node => node['@type'] === 'Organization')), 'Organization schema');
assert.ok(jsonLd.some(obj => obj['@graph']?.some(node => node['@type'] === 'WebSite')), 'WebSite schema');
assert.ok(!/https:\/\/recruiterreply\.com\/(login|register|dashboard|profile)</.test(sitemap), 'no auth pages in sitemap');
console.log('SEO metadata and sitemap checks passed');

for (const slug of ['seo-recruiter-replies', 'seo-job-offer-comparison', 'seo-salary-negotiation']) {
  const page = readFileSync(new URL(`../dist/${slug}.html`, import.meta.url), 'utf8');
  assert.match(page, /<h1>[^<]+<\/h1>/i, `${slug} has a readable H1`);
  assert.match(page, /<meta name="description" content="[^"]+"/i, `${slug} has description`);
  assert.match(page, new RegExp(`<link rel="canonical" href="https://recruiterreply.com/${slug}\\.html"`));
  assert.match(sitemap, new RegExp(`https://recruiterreply.com/${slug}\\.html`));
}
console.log('Static landing page SEO checks passed');
