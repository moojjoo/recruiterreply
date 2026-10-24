'use strict';

const LIMITS = Object.freeze({dev: 10, test: 5, prod: 4});
const FULL_SHA = /^[a-f0-9]{40}$/;

async function resolveImageRetentionPolicy({github, context, core, currentEnvironment, currentSha}) {
  const {owner, repo} = context.repo;
  const policy = {};

  if ((currentEnvironment || currentSha) &&
      (!Object.hasOwn(LIMITS, currentEnvironment) || !FULL_SHA.test(currentSha || ''))) {
    throw new Error('Current deployment must identify dev, test, or prod with a full lowercase commit SHA');
  }

  for (const [environment, limit] of Object.entries(LIMITS)) {
    const shas = [];
    if (environment === currentEnvironment) shas.push(currentSha);

    const deployments = await github.paginate(github.rest.repos.listDeployments, {
      owner, repo, environment, per_page: 100
    });
    for (const deployment of deployments) {
      if (shas.length >= limit) break;
      if (!FULL_SHA.test(deployment.sha) || shas.includes(deployment.sha)) continue;
      const {data: statuses} = await github.rest.repos.listDeploymentStatuses({
        owner, repo, deployment_id: deployment.id, per_page: 100
      });
      // The latest status is authoritative. Never resurrect a deployment whose
      // most recent status is failed, inactive, or otherwise non-successful.
      if (statuses[0]?.state !== 'success') continue;
      shas.push(deployment.sha);
    }

    if (shas.length === 0) {
      throw new Error(`No successful ${environment} deployment with a full SHA was found`);
    }
    policy[environment] = shas;
    core.info(`Retention history ${environment}: ${shas.length}/${limit}`);
  }

  return policy;
}

resolveImageRetentionPolicy.LIMITS = LIMITS;
module.exports = resolveImageRetentionPolicy;
