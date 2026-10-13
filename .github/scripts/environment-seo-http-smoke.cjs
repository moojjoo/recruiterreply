#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const env = process.env.SEO_ENVIRONMENT;
const hosts = {
  dev: 'https://dev.recruiterreply.com',
  test: 'https://test.recruiterreply.com',
  prod: 'https://recruiterreply.com',
};
assert.ok(Object.hasOwn(hosts, env), 'SEO_ENVIRONMENT must be dev, test, or prod');
const base = hosts[env];
async function check(path) {
  const res = await fetch(base + path, {signal: AbortSignal.timeout(15000), redirect:'follow'});
  assert.equal(res.status, 200, path + ' must return HTTP 200');
  const robots = res.headers.get('x-robots-tag') || '';
  if (env === 'prod') assert.doesNotMatch(robots, /\bnoindex\b/i, path + ' must remain indexable');
  else assert.match(robots, /\bnoindex\b/i, path + ' must be noindex');
  const body = await res.text();
  return {res, body};
}
(async () => {
  const home = await check('/');
  assert.match(home.res.headers.get('content-type') || '', /text\/html/i);
  assert.match(home.body, /data-prerendered="react"/i, 'Homepage must be prerendered');
  const root = home.body.slice(home.body.indexOf('<div id="root"'), home.body.indexOf('</body>'));
  const headings = [...root.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
  assert.equal(headings.length, 1, 'Homepage must contain exactly one prerendered H1');
  assert.match(headings[0][1].replace(/<[^>]+>/g, ' '), /Master Your Job Search/i, 'H1 must describe the actual homepage');
  assert.match(root, /Message Analyzer/i, 'Prerendered homepage must describe its real features');
  assert.match(root, /Reply Generator/i, 'Prerendered homepage must describe reply generation');
  assert.match(root, /Offer Comparison/i, 'Prerendered homepage must describe offer comparison');
  assert.match(root, /<a\s+[^>]*href=/i, 'Prerendered homepage must contain navigable links');
  assert.match(home.body, /<title>[^<]*RecruiterReply[^<]*<\/title>/i, 'Homepage needs a meaningful title');
  assert.match(home.body, /<meta\b(?=[^>]*name="description")(?=[^>]*content="[^"]+")[^>]*>/i, 'Homepage needs a description');
  assert.match(home.body, /<link\s+rel="canonical"\s+href="https:\/\/recruiterreply\.com\/"/i, 'Homepage needs production canonical');
  const jsonLd = [...home.body.matchAll(/<script\s+type="application\/ld\+json"\s*>([\s\S]*?)<\/script>/gi)];
  assert.ok(jsonLd.length > 0, 'Homepage needs structured data');
  for (const block of jsonLd) assert.doesNotThrow(() => JSON.parse(block[1]), 'Structured data must be valid JSON');
  for (const slug of ['seo-recruiter-replies','seo-job-offer-comparison','seo-salary-negotiation']) {
    const page = await check('/' + slug + '.html');
    assert.match(page.body, /<h1\b/i, slug + ' must contain a raw H1');
    assert.match(page.body, /rel="canonical"/i, slug + ' must have canonical');
  }
  const robots = await check('/robots.txt');
  assert.match(robots.res.headers.get('content-type') || '', /text\/plain/i);
  assert.match(robots.body, /^User-agent:\s*\*/mi);
  if (env === 'prod') assert.doesNotMatch(robots.body, /^Disallow:\s*\/\s*$/mi, 'Production robots must not block all crawlers');
  else assert.match(robots.body, /^Disallow:\s*\/\s*$/mi, env + ' robots must disallow all');
  const sitemap = await check('/sitemap.xml');
  assert.match(sitemap.res.headers.get('content-type') || '', /xml/i);
  assert.match(sitemap.body, /<urlset\b/i);
  console.log(env + ' live SEO HTTP assertions passed');
})().catch(e => { console.error('SEO HTTP verification failed:', e); process.exitCode = 1; });
