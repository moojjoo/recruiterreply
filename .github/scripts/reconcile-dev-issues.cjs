// Post-deployment reconciliation: fail closed on missing evidence or permissions.
const MARKER = /(?:^|\n)Dev-Completes:\s*#(\d+)\b/gim;
const eligibleLabel = 'dev-acceptance-verified';
const requiredChecks = ['verify', 'test', 'CodeQL required gate'];

function linkedIssues(body = '') {
  return [...new Set([...body.matchAll(MARKER)].map(m => Number(m[1])))];
}
function findProject(projects) {
  const matches = projects.filter(p => ["recruiterreply project", "@moojjoo's recruiterreply project"].includes(p.title.toLowerCase()));
  if (matches.length !== 1) throw new Error('Expected exactly one RecruiterReply GitHub Project; found ' + matches.length);
  return matches[0];
}
function acceptanceChecklistComplete(body = '') {
  const section = body.match(/^## Acceptance criteria[^\n]*\n([\s\S]*)$/im);
  const criteria = section?.[1].split(/^## /m, 1)[0] || '';
  return /^\s*[-*]\s*\[[xX]\]/m.test(criteria) && !/^\s*[-*]\s*\[ \]/m.test(criteria);
}
function checksPass(checks, headSha, names = requiredChecks) {
  return names.every(name => checks.some(check => check.name === name && check.head_sha === headSha && check.conclusion === 'success'));
}
async function findVerifiedDeploymentForIssue({github, owner, repo, issueNumber}) {
  const prs = await github.paginate(github.rest.pulls.list, {
    owner, repo, state: 'closed', base: 'main', sort: 'updated', direction: 'desc', per_page: 100
  });
  const pr = prs.find(candidate => candidate.merged_at && linkedIssues(candidate.body || '').includes(issueNumber));
  if (!pr?.merge_commit_sha) return null;
  const runs = await github.paginate(github.rest.actions.listWorkflowRunsForRepo, {
    owner, repo, head_sha: pr.merge_commit_sha, per_page: 100
  });
  const run = runs.find(candidate => candidate.name === 'Build and Deploy to Dev' &&
    candidate.head_sha === pr.merge_commit_sha && candidate.conclusion === 'success');
  return run ? {pr, sha: run.head_sha, runUrl: run.html_url} : null;
}
module.exports = async ({github, context, core}) => {
  const {owner, repo} = context.repo;
  let sha = context.sha;
  let runUrl = `${context.serverUrl}/${owner}/${repo}/actions/runs/${context.runId}`;
  let merged;
  if (context.eventName === 'issues') {
    if (context.payload.action !== 'labeled' || context.payload.label?.name !== eligibleLabel) {
      core.notice('Not a Dev acceptance label event; skipping reconciliation.');
      return;
    }
    const deployment = await findVerifiedDeploymentForIssue({
      github, owner, repo, issueNumber: context.payload.issue.number
    });
    if (!deployment) {
      core.notice(`#${context.payload.issue.number}: no verified Dev deployment found; no issues changed.`);
      return;
    }
    sha = deployment.sha;
    runUrl = deployment.runUrl;
    merged = [deployment.pr];
  } else if (context.ref !== 'refs/heads/main' || !['push', 'workflow_dispatch'].includes(context.eventName)) {
    core.notice('Not a main deployment event; skipping reconciliation.');
    return;
  }
  if (!process.env.PROJECTS_WRITE_TOKEN) {
    core.warning('Missing PROJECTS_WRITE_TOKEN (Projects write + Issues write); no issues changed.');
    return;
  }
  if (process.env.DEV_DEPLOYMENT_VERIFIED !== 'true') {
    core.warning('Trusted Dev deployment verification is absent; no issues changed.');
    return;
  }
  if (!merged) {
    const prs = await github.paginate(github.rest.repos.listPullRequestsAssociatedWithCommit,
      {owner, repo, commit_sha: sha, per_page: 100});
    merged = prs.filter(pr => pr.merged_at && pr.base.ref === 'main' && pr.merge_commit_sha === sha);
  }
  if (!merged.length) {
    core.notice('No matching merged PR for deployed SHA; no issues changed.');
    return;
  }
  const result = await github.graphql(`query {
    user(login: "moojjoo") {
      projectsV2(first: 100) {
        nodes { id title fields(first: 100) { nodes {
          ... on ProjectV2SingleSelectField { id name options { id name } }
        } } }
      }
    }
  }`);
  const target = findProject(result.user?.projectsV2?.nodes || []);
  const field = target.fields.nodes.find(f => f.name === 'Status' && f.options);
  const done = field?.options.find(o => o.name === 'Done');
  if (!field || !done) throw new Error('Project Status/Done field missing');
  for (const pr of merged) {
    if (!acceptanceChecklistComplete(pr.body || '')) {
      core.warning(`#${pr.number}: acceptance checklist is missing or incomplete; skipped`);
      continue;
    }
    const checks = await github.paginate(github.rest.checks.listForRef,
      {owner, repo, ref: pr.head.sha, per_page: 100});
    if (!checksPass(checks, pr.head.sha)) {
      core.warning(`#${pr.number}: required current-head checks are incomplete; skipped`);
      continue;
    }
    for (const issue_number of linkedIssues(pr.body || '')) {
      const {data: issue} = await github.rest.issues.get({owner, repo, issue_number});
      if (issue.pull_request) continue;
      const items = await github.graphql(`query($id: ID!) {
        node(id: $id) { ... on Issue { projectItems(first: 100) {
          nodes { id project { id } }
        } } }
      }`, {id: issue.node_id});
      const item = items.node?.projectItems?.nodes?.find(i => i.project.id === target.id);
      if (!item) {
        core.warning(`#${issue_number}: not in target project; skipped`);
        continue;
      }
      const marker = `<!-- dev-reconcile:${sha}:issue-${issue_number} -->`;
      const comments = await github.paginate(github.rest.issues.listComments,
        {owner, repo, issue_number, per_page: 100});
      if (issue.state === 'closed' && comments.some(c => c.body?.includes(marker))) {
        core.notice(`#${issue_number}: already reconciled`);
        continue;
      }
      if (issue.state !== 'open') {
        core.warning(`#${issue_number}: already closed without reconciliation evidence; manual review needed`);
        continue;
      }
      await github.graphql(`mutation($project: ID!, $item: ID!, $field: ID!, $option: String!) {
        updateProjectV2ItemFieldValue(input: {
          projectId: $project, itemId: $item, fieldId: $field,
          value: {singleSelectOptionId: $option}
        }) { projectV2Item { id } }
      }`, {project: target.id, item: item.id, field: field.id, option: done.id});
      // Comment first so a closure failure can be retried without losing the audit trail.
      if (!comments.some(c => c.body?.includes(marker))) {
        await github.rest.issues.createComment({owner, repo, issue_number, body:
          `${marker}\nDev acceptance verified. PR #${pr.number}; deployed SHA \`${sha}\`; workflow ${runUrl}.\nProject Status: Done.`});
      }
      await github.rest.issues.update({owner, repo, issue_number, state: 'closed', state_reason: 'completed'});
      core.notice(`#${issue_number}: closed and marked Done`);
    }
  }
};
module.exports.linkedIssues = linkedIssues;
module.exports.findProject = findProject;
module.exports.acceptanceChecklistComplete = acceptanceChecklistComplete;
module.exports.checksPass = checksPass;
module.exports.findVerifiedDeploymentForIssue = findVerifiedDeploymentForIssue;
module.exports.requiredChecks = requiredChecks;
