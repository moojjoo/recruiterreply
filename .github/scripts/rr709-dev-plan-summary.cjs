'use strict';

const EXPECTED_CREATES = Object.freeze([
  'aws_route53_record.application_managed_login["dev"]',
  'module.cognito_bff["dev"].aws_cognito_managed_login_branding.bff[0]',
  'module.private_environment_identity["dev"].aws_cognito_user_pool_domain.application_managed[0]',
]);

function summarize(plan) {
  if (
    !plan
    || plan.complete !== true
    || plan.applyable !== true
    || plan.errored !== false
    || !Array.isArray(plan.resource_changes)
  ) {
    throw new Error('invalid-plan');
  }

  const material = [];
  for (const change of plan.resource_changes) {
    const actions = change?.change?.actions;
    if (actions?.length === 1 && actions[0] === 'no-op') {
      continue;
    }
    if (change?.mode === 'data' && actions?.length === 1 && actions[0] === 'read') {
      continue;
    }
    material.push({ address: change?.address, actions });
  }

  material.sort((left, right) => String(left.address).localeCompare(String(right.address)));
  if (material.length !== EXPECTED_CREATES.length) {
    throw new Error('unexpected-change-count');
  }
  for (let index = 0; index < EXPECTED_CREATES.length; index += 1) {
    if (
      material[index].address !== EXPECTED_CREATES[index]
      || material[index].actions?.length !== 1
      || material[index].actions[0] !== 'create'
    ) {
      throw new Error('unexpected-change');
    }
  }

  return material.map(({ address }) => `- create \`${address}\``).join('\n');
}

async function main() {
  let input = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) {
    input += chunk;
  }
  try {
    process.stdout.write(`${summarize(JSON.parse(input))}\n`);
  } catch {
    process.stderr.write('::error::RR-709 plan contains an unapproved action or address.\n');
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = { EXPECTED_CREATES, summarize };
