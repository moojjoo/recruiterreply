#!/usr/bin/env node
// Read-only, conservative reconciliation report. Never changes issue state.
const fs = require('node:fs');
const https = require('node:https');
const repo = process.env.GITHUB_REPOSITORY || 'moojjoo/recruiterreply';
const token = process.env.GITHUB_TOKEN || '';
function request(path) {
  return new Promise((resolve, reject) => {
    const req = https.get({hostname:'api.github.com',path,headers:{
      'User-Agent':'recruiterreply-reconciliation-audit',
      'Accept':'application/vnd.github+json',
      ...(token ? {Authorization:'Bearer '+token} : {})
    }}, res => {
      let data = ''; res.on('data', x=>data+=x); res.on('end',()=>{
        if(res.statusCode<200||res.statusCode>=300) return reject(new Error('GitHub API HTTP '+res.statusCode+' at '+path));
        try { resolve(JSON.parse(data)); } catch(e) { reject(e); }
      });
    });
    req.on('error',reject);
  });
}
const marker = /(?:^|\n)Dev-Completes:\s*#(\d+)\b/gim;
const references = /(?:^|\n)Refs\s+#(\d+)\b/gim;
function ids(body, regex) { return [...new Set([...String(body||'').matchAll(regex)].map(m=>Number(m[1])))]; }
function inspect(pr, issue) {
  const blockers = [];
  if(!ids(pr.body,marker).includes(issue.number)) blockers.push('missing final Dev-Completes marker');
  if(!issue.labels?.some(l=>l.name==='dev-acceptance-verified')) blockers.push('missing human-approved dev-acceptance-verified label');
  if(/\[ \]/.test(issue.body||'')) blockers.push('unfinished issue acceptance checklist');
  if(/\[ \]/.test(pr.body||'')) blockers.push('unfinished PR acceptance checklist');
  // Absence of independently verified CI/deployment evidence must not be interpreted as success.
  blockers.push('current-head CI/security, deployed Dev SHA and smoke evidence not independently verified');
  blockers.push('GitHub Project membership and token permissions not independently verified');
  return blockers;
}
async function main(){
  const [owner,name]=repo.split('/');
  if(!owner||!name) throw new Error('GITHUB_REPOSITORY must be owner/repo');
  const prs=await request('/repos/'+owner+'/'+name+'/pulls?state=closed&sort=updated&direction=desc&per_page=100');
  const merged=prs.filter(p=>p.merged_at && p.base?.ref==='main');
  const issues=new Map();
  const results=[];
  for(const pr of merged) {
    const final=ids(pr.body,marker);
    const partial=ids(pr.body,references);
    for(const number of [...new Set([...final,...partial])]) {
      if(!issues.has(number)) {
        try { issues.set(number,await request('/repos/'+owner+'/'+name+'/issues/'+number)); }
        catch(e) { results.push({issue:number,pr:pr.number,error:String(e)});continue; }
      }
      const issue=issues.get(number);
      if(issue.state!=='open'||issue.pull_request) continue;
      results.push({issue:number,pr:pr.number,kind:final.includes(number)?'final-marker':'partial-reference',
        blockers:inspect(pr,issue)});
    }
  }
  results.sort((a,b)=>a.issue-b.issue||a.pr-b.pr);
  const report={generated_at:new Date().toISOString(),repository:repo,read_only:true,
    note:'Limited to 100 recently updated closed PRs; not exhaustive. Missing evidence is never a pass.',
    merged_prs_examined:merged.length,open_issue_links:results};
  const output=JSON.stringify(report,null,2)+'\n';
  fs.mkdirSync('reconciliation-report',{recursive:true});
  fs.writeFileSync('reconciliation-report/report.json',output);
  const summary=['## Read-only Dev issue reconciliation','',report.note,'',
    '| Issue | Merged PR | Link type | Blockers |','| --- | --- | --- | --- |',
    ...results.map(x=>`| #${x.issue} | #${x.pr} | ${x.kind||'lookup error'} | ${(x.blockers||[x.error]).join('; ').replace(/\|/g,'\\|')} |`)].join('\n')+'\n';
  fs.writeFileSync('reconciliation-report/summary.md',summary);
  if(process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);
  process.stdout.write(summary);
}
if(require.main===module) main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={ids,inspect,marker,references};
