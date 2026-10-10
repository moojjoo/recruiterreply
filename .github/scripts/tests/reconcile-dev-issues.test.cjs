const test = require('node:test');
const assert = require('node:assert/strict');
const {linkedIssues, findProject} = require('../reconcile-dev-issues.cjs');

test('only explicit Dev-Completes markers qualify', () => {
  assert.deepEqual(linkedIssues('Refs #12\nCloses #13\nDev-Completes: #14\nDev-Completes: #14\nDev-Completes: #15'), [14, 15]);
});
test('missing completion markers never qualify', () => {
  assert.deepEqual(linkedIssues('Closes #239\nFixes #217'), []);
});
test('project matches either GitHub display title or bare title', () => {
  assert.equal(findProject([{id:'p',title:'recruiterreply project'}]).id, 'p');
  assert.equal(findProject([{id:'q',title:"@moojjoo's recruiterreply project"}]).id, 'q');
});
test('missing or ambiguous project fails closed', () => {
  assert.throws(() => findProject([]), /exactly one/);
  assert.throws(() => findProject([{title:'recruiterreply project'},{title:"@moojjoo's recruiterreply project"}]), /exactly one/);
});
