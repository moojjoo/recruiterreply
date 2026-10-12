'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const root = 'frontend/';
const html = fs.readFileSync(root + 'index.html','utf8');
const sitemap = fs.readFileSync(root + 'public/sitemap.xml','utf8');
const robots = fs.readFileSync(root + 'public/robots.txt','utf8');
assert.match(html, /<title>RecruiterReply[^<]*<\/title>/);
assert.match(html, /<link rel="canonical" href="https:\/\/recruiterreply\.com\/"\s*\/>/);
assert.match(html, /name="description"/);
const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
assert.ok(blocks.length, 'structured data must exist');
for (const block of blocks) {
 const json = JSON.parse(block[1]);
 assert.equal(json['@context'],'https://schema.org');
 assert.ok(json['@type'] || (Array.isArray(json['@graph']) && json['@graph'].every(n => n['@type'])));
}
assert.match(sitemap, /<urlset\b/);
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
assert.ok(urls.length,'sitemap must contain URLs');
assert.equal(new Set(urls).size,urls.length,'sitemap duplicate URLs');
for (const url of urls) {
 const u = new URL(url);
 assert.equal(u.origin,'https://recruiterreply.com');
 assert.ok(!/(login|register|dashboard|profile|analyze|reply|compare|opportunities)/.test(u.pathname),'private route in sitemap');
}
assert.match(robots, /Sitemap: https:\/\/recruiterreply\.com\/sitemap\.xml/);
console.log('SEO static metadata, JSON-LD, sitemap and robots checks passed');
