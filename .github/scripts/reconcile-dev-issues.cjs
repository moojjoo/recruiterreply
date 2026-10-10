const PROJECT_NAME = "@moojjoo's recruiterreply project";
const COMPLETION_GATE = '<!-- dev-acceptance-verified -->';

async function projectGraphql(query, variables) {
  const token = process.env.PROJECTS_WRITE_TOKEN;
  if (!token) {
    throw new Error('Set the PROJECTS_WRITE_TOKEN secret to a token with access to the target GitHub Project.');
  }

  const response = await fetch(`${process.env.GITHUB_API_URL || 'https://api.github.com'}/graphql`, {
    method: 'POST',
    headers: {
      authorization: 'Bearer ' + token,
      'content-type': 'application/json',
      accept: 'application/vnd.github+json',
    },
    body: JSON.stringify({query, variables}),
  });
  const result = await response.json();
  if (!response.ok || result.errors?.length) {
    throw new Error(`GitHub Projects API request failed with status ${response.status}. Verify PROJECTS_WRITE_TOKEN has read/write access to the target project.`);
  }
  return result.data;
}

async function collectPages(request, connectionPath) {
  const nodes = [];
  let cursor;
  do {
    const result = await request(cursor);
    const connection = connectionPath.reduce((value, key) => value?.[key], result);
    if (!connection) throw new Error('GitHub Projects API returned an unexpected response.');
    nodes.push(...connection.nodes);
    cursor = connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : undefined;
  } while (cursor);
  return nodes;
}

function linkedIssueNumbers(body = '') {
  const numbers = new Set();
  for (const line of body.split(/\r?\n/)) {
    if (!/^\s*(?:[-*]\s*)?Closes\s+#\d+\b/i.test(line)) continue;
    for (const match of line.matchAll(/\bCloses\s+#(\d+)\b/gi)) {
      numbers.add(Number(match[1]));
    }
  }
  return [...numbers];
}

function hasCompletionGate(body = '') {
  return body.split(/\r?\n/).some(line => line.trim() === COMPLETION_GATE);
}

async function getTargetProject(graphql) {
  const projects = await collectPages(
    cursor => graphql(`query($cursor: String) {
      user(login: "moojjoo") {
        projectsV2(first: 100, after: $cursor) {
          nodes {
            id
            title
            fields(first: 100) {
              nodes {
                ... on ProjectV2SingleSelectField {
                  id
                  name
                  options { id name }
                }
              }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    }`, {cursor}),
    ['user', 'projectsV2'],
  );
  const matches = projects.filter(project => project.title === PROJECT_NAME);
  if (matches.length !== 1) {
    throw new Error(`Expected one GitHub Project named "${PROJECT_NAME}", found ${matches.length}.`);
  }

  const project = matches[0];
  const statusFields = project.fields.nodes.filter(field => field.name === 'Status' && field.options);
  if (statusFields.length !== 1) throw new Error('Expected one Status single-select field in the target project.');
  const doneOptions = statusFields[0].options.filter(option => option.name === 'Done');
  if (doneOptions.length !== 1) throw new Error('Expected one Done option in the target project Status field.');
  return {project, field: statusFields[0], done: doneOptions[0]};
}

async function getProjectItem(issueId, projectId, graphql) {
  const items = await collectPages(
    cursor => graphql(`query($id: ID!, $cursor: String) {
      node(id: $id) {
        ... on Issue {
          projectItems(first: 100, after: $cursor) {
            nodes {
              id
              project { id }
              fieldValues(first: 100) {
                nodes {
                  ... on ProjectV2ItemFieldSingleSelectValue {
                    name
                    field {
                      ... on ProjectV2SingleSelectField { id name }
                    }
                  }
                }
              }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
      }
    }`, {id: issueId, cursor}),
    ['node', 'projectItems'],
  );
  return items.find(item => item.project.id === projectId);
}

async function setProjectStatus({projectId, item, field, done, graphql}) {
  const current = item.fieldValues.nodes.find(
    value => value.field?.id === field.id,
  );
  if (current?.name === 'Done') return false;

  await graphql(`mutation($project: ID!, $item: ID!, $field: ID!, $option: String!) {
    updateProjectV2ItemFieldValue(input: {
      projectId: $project
      itemId: $item
      fieldId: $field
      value: {singleSelectOptionId: $option}
    }) { projectV2Item { id } }
  }`, {project: projectId, item: item.id, field: field.id, option: done.id});
  return true;
}

async function reconcile({github, context, core, graphql = projectGraphql}) {
  const {owner, repo} = context.repo;
  const sha = context.sha;
  const runUrl = `${context.serverUrl}/${owner}/${repo}/actions/runs/${context.runId}`;
  const associated = await github.paginate(github.rest.repos.listPullRequestsAssociatedWithCommit, {
    owner, repo, commit_sha: sha, per_page: 100,
  });
  const merged = associated.filter(pr =>
    pr.merged_at && pr.base.ref === 'main' && pr.merge_commit_sha === sha,
  );
  const entries = new Map();
  const skippedEntries = new Map();

  for (const pr of merged) {
    const issueNumbers = linkedIssueNumbers(pr.body);
    if (!hasCompletionGate(pr.body)) {
      for (const issueNumber of issueNumbers) {
        skippedEntries.set(issueNumber, {
          issueNumber,
          prs: [pr.number],
          skipped: 'PR is missing the verified acceptance-gate marker.',
        });
      }
      continue;
    }
    for (const issueNumber of issueNumbers) {
      const entry = entries.get(issueNumber) || {issueNumber, prs: []};
      entry.prs.push(pr.number);
      entries.set(issueNumber, entry);
    }
  }
  for (const [issueNumber, entry] of skippedEntries) {
    if (!entries.has(issueNumber)) entries.set(issueNumber, entry);
  }

  if (entries.size === 0) {
    core.notice('No explicitly linked issues were found on eligible merged PRs; no issues changed.');
    await core.summary.addHeading('Dev issue reconciliation').addRaw('No eligible linked issues found.').write();
    return;
  }

  const outcomes = [];
  const failures = [];
  const eligible = [...entries.values()].filter(entry => !entry.skipped);
  let target;
  if (eligible.length) {
    try {
      target = await getTargetProject(graphql);
    } catch (error) {
      for (const entry of eligible) {
        failures.push({entry, error});
      }
    }
  }

  for (const entry of entries.values()) {
    if (entry.skipped) {
      outcomes.push({...entry, outcome: `Skipped: ${entry.skipped}`});
      continue;
    }
    if (!target) continue;

    try {
      const {data: issue} = await github.rest.issues.get({
        owner, repo, issue_number: entry.issueNumber,
      });
      if (issue.pull_request) throw new Error(`#${entry.issueNumber} resolves to a pull request, not an issue.`);

      const item = await getProjectItem(issue.node_id, target.project.id, graphql);
      if (!item) throw new Error(`#${entry.issueNumber} is not in "${PROJECT_NAME}".`);

      const projectUpdated = await setProjectStatus({
        projectId: target.project.id, item, field: target.field, done: target.done,
        graphql,
      });
      const issueClosed = issue.state === 'open';
      if (issueClosed) {
        await github.rest.issues.update({
          owner, repo, issue_number: entry.issueNumber,
          state: 'closed', state_reason: 'completed',
        });
      }

      const marker = `<!-- dev-reconcile:${sha}:issue-${entry.issueNumber} -->`;
      const comments = await github.paginate(github.rest.issues.listComments, {
        owner, repo, issue_number: entry.issueNumber, per_page: 100,
      });
      if (!comments.some(comment => comment.body?.includes(marker))) {
        const prs = [...new Set(entry.prs)].map(number => `#${number}`).join(', ');
        const outcome = issueClosed ? 'closed as completed' : 'already closed; project status verified';
        await github.rest.issues.createComment({
          owner, repo, issue_number: entry.issueNumber,
          body: `${marker}\nDev reconciliation outcome: ${outcome}.\nPR: ${prs}\nSHA: \`${sha}\`\nRun: ${runUrl}`,
        });
      }
      outcomes.push({
        ...entry,
        outcome: `${issueClosed ? 'Closed' : 'Already closed'}; project ${projectUpdated ? 'set to Done' : 'already Done'}`,
      });
    } catch (error) {
      failures.push({entry, error});
    }
  }

  for (const {entry, error} of failures) {
    outcomes.push({...entry, outcome: `Failed: ${error.message}`});
  }
  const rows = outcomes.map(entry => [
    `#${entry.issueNumber}`,
    entry.prs.length ? [...new Set(entry.prs)].map(number => `#${number}`).join(', ') : '—',
    entry.outcome,
  ]);
  await core.summary
    .addHeading('Dev issue reconciliation')
    .addTable([['Issue', 'Linked PR(s)', 'Outcome'], ...rows])
    .addRaw(`\nSHA: \`${sha}\` · [Workflow run](${runUrl})`)
    .write();

  for (const entry of outcomes) core.notice(`#${entry.issueNumber}: ${entry.outcome}`);
  if (failures.length) {
    throw new Error(`Reconciliation failed for ${failures.length} linked issue(s); see the job summary.`);
  }
}

module.exports = reconcile;
module.exports.linkedIssueNumbers = linkedIssueNumbers;
module.exports.hasCompletionGate = hasCompletionGate;
