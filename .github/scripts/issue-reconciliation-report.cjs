'use strict';
// Read-only report. Never close issues or apply acceptance labels.
const {linkedIssues} = require('./reconcile-dev-issues.cjs');
function blockers({pr, issue, deployed, checks = []}) {
  const reasons = [];
  if (!linkedIssues(pr.body || '').includes(issue.number)) reasons.push('No final Dev-Completes marker');
  if (!(issue.labels || []).some(l => l.name === 'dev-acceptance-verified')) reasons.push('Missing controlled acceptance approval');
  if (!deployed) reasons.push('No verified Dev deployment for merge SHA');
  const bad = checks.filter(c => c.conclusion && c.conclusion !== 'success' && c.conclusion !== 'skipped');
  if (bad.length) reasons.push('Failed CI: ' + bad.map(c => c.name).join(', '));
  return reasons;
}
async function report({github, context, core}) {
  const {owner, repo} = context.repo;
  const prs = await github.paginate(github.rest.pulls.list,{owner,repo,state:'closed',per_page:100});
  const merged = prs.filter(p => p.merged_at && p.base.ref === 'main').slice(0,100);
  const rows = [];
  for (const pr of merged) {
    const ids = linkedIssues(pr.body || '');
    for (const number of ids) {
      const {data:issue} = await github.rest.issues.get({owner,repo,issue_number:number});
      if (issue.state !== 'open' || issue.pull_request) continue;
      const runs = await github.paginate(github.rest.actions.listWorkflowRunsForRepo,{owner,repo,head_sha:pr.merge_commit_sha,per_page:100});
      const deployed = runs.some(r => r.name === 'Build and Deploy to Dev' && r.head_sha === pr.merge_commit_sha && r.conclusion === 'success');
      const reasons = blockers({pr,issue:{...issue,number},deployed});
      rows.push({issue:number,pr:pr.number,sha:pr.merge_commit_sha,reasons:reasons.length?reasons:['Verify GitHub Project membership, token permission and reconciliation logs']});
    }
  }
  const lines = rows.length ? rows.map(r => '- Issue #' + r.issue + ' (PR #' + r.pr + ', SHA ' + r.sha.slice(0,12) + '): ' + r.reasons.join('; ')) : ['No merged PR with an explicit Dev-Completes marker has an open issue in the scanned recent PRs.'];
  const output = '# Dev issue reconciliation audit\\n\\n' + lines.join('\\n') + '\\n';
  core.summary.addRaw(output).write();
  core.notice('Open completed-issue candidates: ' + rows.length);
  return rows;
}
module.exports = {blockers,report};
