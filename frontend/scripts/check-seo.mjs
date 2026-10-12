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
const jsonLd = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
assert.ok(jsonLd.some(obj => obj['@type'] === 'SoftwareApplication'), 'SoftwareApplication schema');
assert.ok(jsonLd.some(obj => obj['@graph']?.some(node => node['@type'] === 'Organization')), 'Organization schema');
assert.ok(jsonLd.some(obj => obj['@graph']?.some(node => node['@type'] === 'WebSite')), 'WebSite schema');
assert.ok(!/https:\/\/recruiterreply\.com\/(login|register|dashboard|profile)</.test(sitemap), 'no auth pages in sitemap');
console.log('SEO metadata and sitemap checks passed');
