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
  assert.match(home.body, /<h1\b/i, 'Homepage must contain a raw H1');
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
