const assert = require('node:assert/strict');
const { ids, inspect, marker, references } = require('./report-dev-reconciliation.cjs');

assert.deepEqual(ids('Refs #320\nDev-Completes: #321', references), [320]);
assert.deepEqual(ids('Refs #320\nDev-Completes: #321', marker), [321]);
assert.deepEqual(ids('Refs #320\nRefs #320', references), [320]);
assert.deepEqual(ids('refs #314\nDEV-COMPLETES: #316', marker), [316]);

function check(body, issue = {}) {
  return inspect({ body }, { number: 320, body: '', labels: [], ...issue });
}
const partial = check('Refs #320\n- [ ] Tests', { body: '- [ ] Validate' });
assert(partial.some(x => x.includes('final Dev-Completes')));
assert(partial.some(x => x.includes('human-approved')));
assert(partial.some(x => x.includes('unfinished')));
assert(partial.some(x => x.includes('not independently verified')));

const approved = check('Dev-Completes: #320\n- [x] Tests', {
  labels: [{ name: 'dev-acceptance-verified' }],
  body: '- [x] Validate'
});
assert(!approved.some(x => x.includes('missing final')));
assert(!approved.some(x => x.includes('missing human-approved')));
assert(!approved.some(x => x.includes('unfinished')));
assert(approved.some(x => x.includes('CI/security')));
assert(approved.some(x => x.includes('Project membership')));

const missingLabel = check('Dev-Completes: #320');
assert(missingLabel.some(x => x.includes('human-approved')));
const wrongIssue = check('Dev-Completes: #316', { labels: [{ name: 'dev-acceptance-verified' }] });
assert(wrongIssue.some(x => x.includes('final Dev-Completes')));
assert.deepEqual(check('Refs #320'), check('Refs #320'), 'Repeated inspections are deterministic');
console.log('Reconciliation report conservative tests passed');
