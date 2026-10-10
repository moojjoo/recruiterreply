// Reconcile only explicitly approved issues after a successful main -> Dev deployment.
// Inputs are provided by the workflow, never by a pull request payload.
module.exports = async ({github, context, core}) => {
  const {owner, repo} = context.repo;
  const sha = context.sha;
  const runUrl = `${context.serverUrl}/${owner}/${repo}/actions/runs/${context.runId}`;
  const projectName = "@moojjoo's recruiterreply project";
  const eligibleLabel = 'dev-acceptance-verified';
  const prs = await github.paginate(github.rest.repos.listPullRequestsAssociatedWithCommit, {owner, repo, commit_sha: sha, per_page: 100});
  const merged = prs.filter(pr => pr.merged_at && pr.base.ref === 'main' && pr.merge_commit_sha === sha);
  if (!merged.length) {
    core.notice('No merged PR directly associated with this deployment SHA; no issues changed.');
    return;
  }
  const projectTokenAvailable = Boolean(process.env.PROJECT_TOKEN);
  if (!projectTokenAvailable) {
    core.warning('PROJECTS_WRITE_TOKEN is missing; reconciliation will not close issues or update project status.');
    return;
  }
  // GitHub Projects v2 requires a token with Projects write access.
  const project = await github.graphql(`query {
    user(login: "moojjoo") {
      projectsV2(first: 100) {
        nodes { id title fields(first: 100) { nodes {
          ... on ProjectV2SingleSelectField { id name options { id name } }
        } } }
      }
    }
  }`);
  const target = project.user.projectsV2.nodes.find(p => p.title === projectName);
  if (!target) throw new Error(`GitHub project not found: ${projectName}`);
  const field = target.fields.nodes.find(f => f.name === 'Status' && f.options);
  const done = field?.options.find(o => o.name === 'Done');
  if (!field || !done) throw new Error('Project Status/Done field missing');
  for (const pr of merged) {
    const references = [...pr.body?.matchAll(/(?:^|\s)Closes\s+#(\d+)\b/gim) || []];
    for (const match of references) {
      const issue_number = Number(match[1]);
      const {data: issue} = await github.rest.issues.get({owner, repo, issue_number});
      if (issue.pull_request || issue.state !== 'open') continue;
      if (!issue.labels.some(l => l.name === eligibleLabel)) {
        core.notice(`#${issue_number} not labeled ${eligibleLabel}; left open`);
        continue;
      }
      const items = await github.graphql(`query($id: ID!) {
        node(id: $id) { ... on Issue {
          projectItems(first: 100) { nodes { id project { id } } }
        } }
      }`, {id: issue.node_id});
      const item = items.node.projectItems.nodes.find(i => i.project.id === target.id);
      if (!item) {
        core.warning(`#${issue_number} is not in the target project; left open`);
        continue;
      }
      // Update project first; do not close issue if project update fails.
      await github.graphql(`mutation($project: ID!, $item: ID!, $field: ID!, $option: String!) {
        updateProjectV2ItemFieldValue(input: {
          projectId: $project, itemId: $item, fieldId: $field,
          value: {singleSelectOptionId: $option}
        }) { projectV2Item { id } }
      }`, {project: target.id, item: item.id, field: field.id, option: done.id});
      await github.rest.issues.update({owner, repo, issue_number, state: 'closed', state_reason: 'completed'});
      const marker = `<!-- dev-reconcile:${sha}:issue-${issue_number} -->`;
      const comments = await github.paginate(github.rest.issues.listComments, {owner, repo, issue_number, per_page: 100});
      if (!comments.some(c => c.body?.includes(marker))) {
        await github.rest.issues.createComment({owner, repo, issue_number, body:
          `${marker}\nCompleted after successful Dev deployment.\nPR: #${pr.number}\nSHA: \`${sha}\`\nRun: ${runUrl}`});
      }
      core.notice(`Closed #${issue_number} and marked Done`);
    }
  }
};
