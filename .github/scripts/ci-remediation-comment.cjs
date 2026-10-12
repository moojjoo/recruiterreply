'use strict';
const {classify,format} = require('./ci-remediation-report.cjs');
const REQUIRED=['verify','test','analyze (javascript-typescript)','analyze (csharp)'];
function actionable({pr,checks}) {
  const failures=classify(checks,pr.head.sha);
  const pending=REQUIRED.filter(name=>!checks.some(c=>c.name===name&&c.head_sha===pr.head.sha&&c.status==='completed'&&c.conclusion==='success'));
  return {failures,pending,body:format(pr.number,failures)+'\n\n### Missing passing required checks\n'+(pending.length?pending.map(x=>'- '+x).join('\n'):'- None')};
}
async function report({github,context,core}) {
  const {owner,repo}=context.repo;
  const prs=context.payload.pull_request?[context.payload.pull_request]:await github.paginate(github.rest.pulls.list,{owner,repo,state:'open',per_page:100});
  for(const pr of prs) {
    if(pr.base.ref!=='main'||pr.draft)continue;
    const {data:checks}=await github.rest.checks.listForRef({owner,repo,ref:pr.head.sha,per_page:100});
    const {failures,pending,body}=actionable({pr,checks:checks.check_runs});
    if(!failures.length)continue;
    const marker='<!-- rr-ci-remediation-v1 -->';
    const comments=await github.paginate(github.rest.issues.listComments,{owner,repo,issue_number:pr.number,per_page:100});
    const existing=comments.find(c=>c.user?.type==='Bot'&&c.body?.includes(marker));
    const text=marker+'\n'+body+'\n\nAutomated retries: 0. Fixes must be reviewed; no code, secrets, IAM, approvals, or branch protections were changed.';
    if(existing&&existing.body===text)continue;
    if(existing)await github.rest.issues.updateComment({owner,repo,comment_id:existing.id,body:text});
    else await github.rest.issues.createComment({owner,repo,issue_number:pr.number,body:text});
    core.notice('PR #'+pr.number+': CI failures documented; missing '+pending.join(', '));
  }
}
module.exports={actionable,report};
