'use strict';
const {linkedIssues} = require('./reconcile-dev-issues.cjs');
const REQUIRED = ['verify','analyze (javascript-typescript)','analyze (csharp)'];
function blockers({pr,issue,checks=[],deployment,projectMember=true,tokenConfigured=true}) {
 const reasons=[];
 if (!linkedIssues(pr.body||'').includes(issue.number)) reasons.push('Missing final Dev-Completes marker');
 if (!(issue.labels||[]).some(l=>l.name==='dev-acceptance-verified')) reasons.push('Missing owner acceptance approval');
 if (!tokenConfigured) reasons.push('PROJECTS_WRITE_TOKEN not configured');
 if (!projectMember) reasons.push('Issue missing from RecruiterReply Project');
 if (!deployment || deployment.conclusion!=='success' || deployment.sha!==pr.merge_commit_sha || !deployment.smokePassed) reasons.push('Missing verified Dev deployment and smoke result for merge SHA');
 for (const name of REQUIRED) if (!checks.some(c=>c.name===name && c.head_sha===pr.head.sha && c.conclusion==='success')) reasons.push('Missing passing current-head check: '+name);
 const criteria=(pr.body||'').match(/^## Acceptance criteria\s*\n([\s\S]*?)(?=^## |\s*$)/mi);
 if (!criteria || !/^\s*[-*]\s*\[[xX]\]/m.test(criteria[1]) || /^\s*[-*]\s*\[ \]/m.test(criteria[1])) reasons.push('Acceptance checklist missing or incomplete');
 return reasons;
}
async function report({github,context,core}) {
 const {owner,repo}=context.repo;
 const prs=await github.paginate(github.rest.pulls.list,{owner,repo,state:'closed',per_page:100});
 const merged=prs.filter(p=>p.merged_at&&p.base.ref==='main').slice(0,100);
 const rows=[];
 for(const pr of merged) {
  const ids=linkedIssues(pr.body||'');
  for(const number of ids) {
   const {data:issue}=await github.rest.issues.get({owner,repo,issue_number:number});
   if(issue.state!=='open'||issue.pull_request) continue;
   const {data:checkResponse}=await github.rest.checks.listForRef({owner,repo,ref:pr.head.sha,per_page:100});
   const runs=await github.paginate(github.rest.actions.listWorkflowRunsForRepo,{owner,repo,head_sha:pr.merge_commit_sha,per_page:100});
   const run=runs.find(r=>r.name==='Build and Deploy to Dev'&&r.head_sha===pr.merge_commit_sha&&r.conclusion==='success');
   // A successful workflow alone does not prove the smoke test. Require explicit trusted evidence.
   const deployment=run?{sha:run.head_sha,conclusion:run.conclusion,smokePassed:false,runUrl:run.html_url}:null;
   const reasons=blockers({pr,issue:{...issue,number},checks:checkResponse.check_runs,deployment,projectMember:false,tokenConfigured:false});
   rows.push({issue:number,pr:pr.number,sha:pr.merge_commit_sha,reasons});
  }
 }
 const lines=rows.length?rows.map(r=>'- Issue #'+r.issue+' (PR #'+r.pr+', SHA '+r.sha.slice(0,12)+'): '+r.reasons.join('; ')):['No open issues with final completion markers among the latest 100 merged PRs.'];
 await core.summary.addRaw('# Dev issue reconciliation audit\n\n'+lines.join('\n')+'\n').write();
 core.notice('Unresolved completion candidates: '+rows.length);
 return rows;
}
module.exports={blockers,report};
