'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const resolvePolicy = require('../resolve-image-retention-policy.cjs');

const SHA = {
  current: 'a'.repeat(40),
  dev: 'b'.repeat(40),
  test: 'c'.repeat(40),
  prod: 'd'.repeat(40),
  failed: 'e'.repeat(40)
};

function harness(histories) {
  const statusById = new Map();
  let nextId = 1;
  const deploymentsByEnvironment = {};
  for (const [environment, deployments] of Object.entries(histories)) {
    deploymentsByEnvironment[environment] = deployments.map(({sha, state}) => {
      const id = nextId++;
      statusById.set(id, state);
      return {id, sha};
    });
  }
  return {
    github: {
      paginate: async (_method, {environment}) => deploymentsByEnvironment[environment] || [],
      rest: {repos: {
        listDeployments() {},
        listDeploymentStatuses: async ({deployment_id}) => ({
          data: [{state: statusById.get(deployment_id)}]
        })
      }}
    },
    context: {repo: {owner: 'owner', repo: 'repo'}},
    core: {info() {}}
  };
}

test('keeps the in-flight SHA and only successful deployment histories', async () => {
  const tools = harness({
    dev: [{sha: SHA.failed, state: 'failure'}, {sha: SHA.dev, state: 'success'}],
    test: [{sha: SHA.test, state: 'success'}],
    prod: [{sha: SHA.prod, state: 'success'}]
  });
  const policy = await resolvePolicy({
    ...tools, currentEnvironment: 'dev', currentSha: SHA.current
  });
  assert.deepEqual(policy, {
    dev: [SHA.current, SHA.dev], test: [SHA.test], prod: [SHA.prod]
  });
});

test('deduplicates shared SHAs and enforces environment limits', async () => {
  const successful = Array.from({length: 12}, (_, index) => ({
    sha: index.toString(16).padStart(40, '0'), state: 'success'
  }));
  const tools = harness({dev: successful, test: successful, prod: successful});
  const policy = await resolvePolicy(tools);
  assert.equal(policy.dev.length, 10);
  assert.equal(policy.test.length, 5);
  assert.equal(policy.prod.length, 4);
  assert.equal(policy.dev[0], policy.test[0]);
});

test('fails closed when an environment has no successful history', async () => {
  const tools = harness({
    dev: [{sha: SHA.dev, state: 'success'}],
    test: [{sha: SHA.failed, state: 'failure'}],
    prod: [{sha: SHA.prod, state: 'success'}]
  });
  await assert.rejects(resolvePolicy(tools), /No successful test deployment/);
});

test('rejects an invalid in-flight deployment identity', async () => {
  const tools = harness({});
  await assert.rejects(
    resolvePolicy({...tools, currentEnvironment: 'dev', currentSha: 'short'}),
    /full lowercase commit SHA/
  );
});
