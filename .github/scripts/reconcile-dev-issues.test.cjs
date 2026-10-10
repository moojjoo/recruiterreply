const assert = require('node:assert/strict');
const test = require('node:test');
const reconcile = require('./reconcile-dev-issues.cjs');

const sha = 'a'.repeat(40);
const projectId = 'project-1';
const statusFieldId = 'status-1';

function createHarness({issues = [1], linkedBody, projectItems = true, projectAccess = true} = {}) {
  const states = new Map(issues.map(number => [number, 'open']));
  const projectStatuses = new Map(issues.map(number => [number, 'Todo']));
  const comments = new Map(issues.map(number => [number, []]));
  const issueUpdates = [];
  const graphqlCalls = [];
  const summary = {
    addHeading() { return this; },
    addRaw() { return this; },
    addTable() { return this; },
    async write() {},
  };
  const core = {notice() {}, summary};
  const associatedPullRequests = [{
    number: 240,
    merged_at: '2026-10-10T20:57:00Z',
    base: {ref: 'main'},
    merge_commit_sha: sha,
    body: linkedBody || `Closes #${issues[0]}\n\n<!-- dev-acceptance-verified -->`,
  }];
  const listAssociated = async () => associatedPullRequests;
  const listComments = async ({issue_number}) => comments.get(issue_number) || [];
  const github = {
    paginate: async (method, parameters) => {
      if (method === listAssociated) return listAssociated(parameters);
      if (method === listComments) return listComments(parameters);
      throw new Error('Unexpected pagination endpoint.');
    },
    rest: {
      repos: {listPullRequestsAssociatedWithCommit: listAssociated},
      issues: {
        get: async ({issue_number}) => ({
          data: {
            node_id: `issue-${issue_number}`,
            state: states.get(issue_number),
          },
        }),
        update: async ({issue_number, state_reason}) => {
          states.set(issue_number, 'closed');
          issueUpdates.push({issue_number, state_reason});
        },
        listComments,
        createComment: async ({issue_number, body}) => {
          comments.get(issue_number).push({body});
        },
      },
    },
  };
  const graphql = async (query, variables) => {
    graphqlCalls.push({query, variables});
    if (!projectAccess) throw new Error('Project access denied.');
    if (query.includes('projectsV2(first: 100')) {
      return {
        user: {
          projectsV2: {
            nodes: [{
              id: projectId,
              title: "@moojjoo's recruiterreply project",
              fields: {
                nodes: [{
                  id: statusFieldId,
                  name: 'Status',
                  options: [{id: 'done-1', name: 'Done'}],
                }],
              },
            }],
            pageInfo: {hasNextPage: false, endCursor: null},
          },
        },
      };
    }
    if (query.includes('projectItems(first: 100')) {
      const number = Number(variables.id.replace('issue-', ''));
      return {
        node: {
          projectItems: {
            nodes: projectItems ? [{
              id: `item-${number}`,
              project: {id: projectId},
              fieldValues: {
                nodes: [{
                  name: projectStatuses.get(number),
                  field: {id: statusFieldId},
                }],
              },
            }] : [],
            pageInfo: {hasNextPage: false, endCursor: null},
          },
        },
      };
    }
    if (query.includes('updateProjectV2ItemFieldValue')) {
      const number = Number(variables.item.replace('item-', ''));
      projectStatuses.set(number, 'Done');
      return {updateProjectV2ItemFieldValue: {projectV2Item: {id: variables.item}}};
    }
    throw new Error('Unexpected GraphQL query.');
  };
  const context = {
    repo: {owner: 'moojjoo', repo: 'recruiterreply'},
    sha,
    runId: 123,
    serverUrl: 'https://github.com',
  };

  return {
    run: () => reconcile({github, context, core, graphql}),
    states,
    projectStatuses,
    comments,
    issueUpdates,
    graphqlCalls,
  };
}

test('closes each explicitly linked issue and marks its project item Done', async () => {
  const harness = createHarness({
    issues: [239, 241],
    linkedBody: 'Closes #239\nCloses #241\n\n<!-- dev-acceptance-verified -->',
  });

  await harness.run();

  assert.deepEqual([...harness.states.values()], ['closed', 'closed']);
  assert.deepEqual([...harness.projectStatuses.values()], ['Done', 'Done']);
  assert.deepEqual(harness.issueUpdates.map(update => update.state_reason), ['completed', 'completed']);
  for (const comments of harness.comments.values()) {
    assert.match(comments[0].body, /PR: #240/);
    assert.match(comments[0].body, new RegExp(`SHA: \`${sha}\``));
    assert.match(comments[0].body, /https:\/\/github\.com\/moojjoo\/recruiterreply\/actions\/runs\/123/);
  }
});

test('does not change issues without the verified acceptance gate', async () => {
  const harness = createHarness({
    issues: [239],
    linkedBody: 'Closes #239\n\nAcceptance tests remain incomplete.',
  });

  await harness.run();

  assert.equal(harness.states.get(239), 'open');
  assert.equal(harness.projectStatuses.get(239), 'Todo');
  assert.equal(harness.graphqlCalls.length, 0);
  assert.equal(harness.comments.get(239).length, 0);
});

test('reruns do not repeat project, issue, or comment writes', async () => {
  const harness = createHarness();

  await harness.run();
  await harness.run();

  assert.equal(harness.issueUpdates.length, 1);
  assert.equal(harness.projectStatuses.get(1), 'Done');
  assert.equal(harness.comments.get(1).length, 1);
});

test('reports project permission failures without closing issues', async () => {
  const harness = createHarness({projectAccess: false});

  await assert.rejects(harness.run(), /Reconciliation failed/);

  assert.equal(harness.states.get(1), 'open');
  assert.equal(harness.projectStatuses.get(1), 'Todo');
});

test('does not close issues missing from the target project', async () => {
  const harness = createHarness({projectItems: false});

  await assert.rejects(harness.run(), /Reconciliation failed/);

  assert.equal(harness.states.get(1), 'open');
  assert.equal(harness.comments.get(1).length, 0);
});
