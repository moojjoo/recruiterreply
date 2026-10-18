const test = require('node:test');
const assert = require('node:assert/strict');
const reconcile = require('../reconcile-dev-issues.cjs');
const {linkedIssues, findProject, acceptanceChecklistComplete, checksPass, requiredChecks} = reconcile;

test('only explicit Dev-Completes markers qualify', () => {
  assert.deepEqual(linkedIssues('Refs #12\nCloses #13\nDev-Completes: #14\nDev-Completes: #14\nDev-Completes: #15'), [14, 15]);
});
test('missing completion markers never qualify', () => {
  assert.deepEqual(linkedIssues('Closes #239\nFixes #217'), []);
});
test('acceptance checklist fails closed when any item is unchecked', () => {
  assert.equal(acceptanceChecklistComplete('## Acceptance criteria\n- [x] One'), true);
  assert.equal(acceptanceChecklistComplete('## Acceptance criteria\n- [x] One\n- [ ] Two'), false);
  assert.equal(acceptanceChecklistComplete('Dev-Completes: #320'), false);
});
test('project matches either GitHub display title or bare title', () => {
  assert.equal(findProject([{id:'p',title:'recruiterreply project'}]).id, 'p');
  assert.equal(findProject([{id:'q',title:"@moojjoo's recruiterreply project"}]).id, 'q');
});
test('missing or ambiguous project fails closed', () => {
  assert.throws(() => findProject([]), /exactly one/);
  assert.throws(() => findProject([{title:'recruiterreply project'},{title:"@moojjoo's recruiterreply project"}]), /exactly one/);
});
test('all required checks must pass on the exact PR head SHA', () => {
  const sha = 'a'.repeat(40);
  const complete = requiredChecks.map(name => ({name, head_sha: sha, conclusion: 'success'}));
  assert.equal(checksPass(complete, sha), true);
  assert.equal(checksPass(complete.slice(1), sha), false);
  assert.equal(checksPass(complete, 'b'.repeat(40)), false);
});

function harness({body = '## Acceptance criteria\n- [x] Complete\n\nDev-Completes: #320', projectItem = true} = {}) {
  const sha = 'a'.repeat(40), headSha = 'b'.repeat(40);
  let state = 'open';
  const comments = [], updates = [], mutations = [];
  const associated = async () => [{number: 42, merged_at: 'now', base: {ref: 'main'}, merge_commit_sha: sha, head: {sha: headSha}, body}];
  const listChecks = async () => requiredChecks.map(name => ({name, head_sha: headSha, conclusion: 'success'}));
  const listComments = async () => comments;
  const github = {
    rest: {
      repos: {listPullRequestsAssociatedWithCommit: associated},
      checks: {listForRef: listChecks},
      issues: {
        get: async () => ({data: {node_id: 'I_320', state, labels: [{name: 'dev-acceptance-verified'}]}}),
        listComments,
        createComment: async ({body: comment}) => comments.push({body: comment}),
        update: async args => { state = args.state; updates.push(args); }
      }
    },
    paginate: async endpoint => endpoint === associated ? associated() : endpoint === listChecks ? listChecks() : listComments(),
    graphql: async (query, variables) => {
      if (query.includes('projectsV2(first: 100')) return {user: {projectsV2: {nodes: [{id: 'P_1', title: 'RecruiterReply Project', fields: {nodes: [{id: 'F_1', name: 'Status', options: [{id: 'O_1', name: 'Done'}]}]}}]}}};
      if (query.includes('projectItems(first: 100')) return {node: {projectItems: {nodes: projectItem ? [{id: 'PI_1', project: {id: 'P_1'}}] : []}}};
      if (query.includes('updateProjectV2ItemFieldValue')) { mutations.push(variables); return {updateProjectV2ItemFieldValue: {projectV2Item: {id: variables.item}}}; }
      throw new Error('Unexpected GraphQL request');
    }
  };
  const notices = [], warnings = [];
  const core = {notice: value => notices.push(value), warning: value => warnings.push(value)};
  const context = {repo: {owner: 'o', repo: 'r'}, sha, ref: 'refs/heads/main', eventName: 'push', serverUrl: 'https://github.com', runId: 9};
  return {github, core, context, comments, updates, mutations, notices, warnings, state: () => state};
}

async function runWithEvidence(subject, verified = true) {
  const oldToken = process.env.PROJECTS_WRITE_TOKEN, oldVerified = process.env.DEV_DEPLOYMENT_VERIFIED;
  process.env.PROJECTS_WRITE_TOKEN = 'configured';
  process.env.DEV_DEPLOYMENT_VERIFIED = verified ? 'true' : 'false';
  try { await reconcile(subject); } finally {
    if (oldToken === undefined) delete process.env.PROJECTS_WRITE_TOKEN; else process.env.PROJECTS_WRITE_TOKEN = oldToken;
    if (oldVerified === undefined) delete process.env.DEV_DEPLOYMENT_VERIFIED; else process.env.DEV_DEPLOYMENT_VERIFIED = oldVerified;
  }
}

test('verified completion closes issue, marks project Done, and is idempotent', async () => {
  const subject = harness();
  await runWithEvidence(subject);
  await runWithEvidence(subject);
  assert.equal(subject.state(), 'closed');
  assert.equal(subject.updates.length, 1);
  assert.equal(subject.mutations.length, 1);
  assert.equal(subject.comments.length, 1);
  assert.match(subject.comments[0].body, /actions\/runs\/9/);
});
test('missing trusted deployment evidence performs no writes', async () => {
  const subject = harness();
  await runWithEvidence(subject, false);
  assert.equal(subject.state(), 'open');
  assert.equal(subject.updates.length + subject.mutations.length + subject.comments.length, 0);
  assert.match(subject.warnings.join(';'), /deployment verification/);
});
test('partial PR and missing project item never close an issue', async () => {
  const partial = harness({body: '## Acceptance criteria\n- [x] Complete\n\nRefs #320'});
  await runWithEvidence(partial);
  assert.equal(partial.state(), 'open');
  const absent = harness({projectItem: false});
  await runWithEvidence(absent);
  assert.equal(absent.state(), 'open');
  assert.match(absent.warnings.join(';'), /not in target project/);
});
