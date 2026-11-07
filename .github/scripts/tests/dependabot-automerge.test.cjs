'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {requiresManualDependabotReview} = require('../pr-readiness.cjs');

test('exact Dependabot author always requires manual review', () => {
  assert.equal(requiresManualDependabotReview({user: {login: 'dependabot[bot]'}}), true);
});

test('lookalike and missing authors do not enter the Dependabot policy path', () => {
  assert.equal(requiresManualDependabotReview({user: {login: 'dependabot'}}), false);
  assert.equal(requiresManualDependabotReview({user: {login: 'octocat'}}), false);
  assert.equal(requiresManualDependabotReview({}), false);
});
