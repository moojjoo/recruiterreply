#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const {setTimeout: delay} = require('node:timers/promises');

const base = (process.env.SEO_BASE_URL || 'https://dev.recruiterreply.com').replace(/\/$/, '');
const timeoutMs = 12000;
async function request(path) {
  const url = base + path;
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {redirect:'follow', signal:AbortSignal.timeout(timeoutMs), headers:{'User-Agent':'RecruiterReply-SEO-Smoke/1.0'}});
      return {response, body:await response.text(),url};
    } catch (error) { last=error; if(attempt<2) await delay(1500); }
  }
  throw new Error('Cannot fetch '+url+': '+last.message);
}
function noindex(response,path) {
  assert.match(response.headers.get('x-robots-tag')||'',/\bnoindex\b/i,path+' must have CloudFront X-Robots-Tag noindex');
}
async function main() {
  const dev = new URL(base).hostname.startsWith('dev.');
  assert.ok(dev, 'This smoke test is Dev-only; refusing to probe another environment');
  const paths=['/','/robots.txt','/sitemap.xml','/seo-recruiter-replies.html','/seo-job-offer-comparison.html','/seo-salary-negotiation.html','/login','/dashboard','/__seo_nonexistent_route_404'];
  const results=[];
  for(const path of paths) {
    const {response,body}=await request(path);
    noindex(response,path);
    const contentType=response.headers.get('content-type')||'';
    if(path==='/robots.txt') {
      assert.equal(response.status,200,'robots.txt must be 200');
      assert.match(contentType,/text\/plain/i,'robots.txt must be text/plain');
      assert.match(body,/User-agent:\s*\*/i);
      assert.match(body,/Disallow:\s*\//i,'Dev robots must disallow crawling');
      assert.doesNotMatch(body,/<html\b/i,'robots must not be SPA fallback');
    } else if(path==='/sitemap.xml') {
      assert.equal(response.status,200,'sitemap must be 200');
      assert.match(contentType,/xml/i,'sitemap must be served as XML');
      assert.match(body,/<urlset\b/i);
      assert.doesNotMatch(body,/<html\b/i,'sitemap must not be SPA fallback');
      for(const match of body.matchAll(/<loc>([^<]+)<\/loc>/g)) {
        const u=new URL(match[1]);
        assert.equal(u.origin,'https://recruiterreply.com','sitemap must use production canonical URLs');
        assert.doesNotMatch(u.pathname,/^\/(login|register|dashboard|profile|analyze|reply|compare)(\/|$)/,'private route in sitemap');
      }
    } else {
      assert.match(contentType,/text\/html/i,path+' must be HTML');
      if(path==='/' || path.startsWith('/seo-')) {
        assert.equal(response.status,200,path+' must be 200');
        assert.match(body,/<h1\b/i,path+' needs crawler-visible H1');
        assert.match(body,/<link rel="canonical"/i,path+' needs canonical');
      }
      if(path==='/') {
        assert.match(body,/Master Your Job Search/i,'Dev must serve the real React homepage, not static placeholder');
        assert.match(body,/data-prerendered="react"/,'Dev must serve React prerender artifact');
        assert.match(body,/Message Analyzer/i,'Dev homepage must include real feature copy');
      }
      if(path==='/dashboard') assert.ok([200,301,302,401,403,404].includes(response.status),'unexpected private route response');
    }
    results.push({path,status:response.status,type:contentType,robots:response.headers.get('x-robots-tag')});
  }
  for(const r of results) console.log(JSON.stringify(r));
  console.log('Dev SEO HTTP smoke passed for '+base);
}
main().catch(e=>{console.error('Dev SEO HTTP smoke FAILED:',e.stack||e);process.exitCode=1;});
