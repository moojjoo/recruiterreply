'use strict';

const EXPECTED_CREATES = Object.freeze([
  'aws_route53_record.application_managed_login["dev"]',
  'module.cognito_bff["dev"].aws_cognito_managed_login_branding.bff[0]',
  'module.private_environment_identity["dev"].aws_cognito_user_pool_domain.application_managed[0]',
]);

class PlanRejectionError extends Error {
  constructor(reason, diagnostic) {
    super(reason);
    this.name = 'PlanRejectionError';
    this.diagnostic = diagnostic;
  }
}

function actionKind(actions) {
  const key = Array.isArray(actions) ? actions.join(',') : '';
  return ({
    'no-op': 'no-op',
    read: 'read',
    create: 'create',
    update: 'update',
    delete: 'delete',
    'delete,create': 'replace',
    'create,delete': 'replace',
  })[key] || 'unknown';
}

function safeAddressKind(address) {
  if (EXPECTED_CREATES.includes(address)) {
    return `approved:${address}`;
  }
  if (typeof address !== 'string' || address.length > 512) {
    return 'unknown-address';
  }

  const withoutIndexes = address.replace(/\[[^\]]*\]/g, '');
  if (!/^[A-Za-z0-9_.-]+$/.test(withoutIndexes)) {
    return 'unknown-address';
  }
  const segments = withoutIndexes.split('.');
  const dataIndex = segments.lastIndexOf('data');
  const typeIndex = dataIndex >= 0 ? dataIndex + 1 : segments.length - 2;
  const type = segments[typeIndex];
  if (!/^[a-z0-9]+(?:_[a-z0-9]+)+$/.test(type || '')) {
    return 'unknown-address';
  }
  return `${dataIndex >= 0 ? 'data' : 'managed'}:${type}`;
}

function reject(reason, changes = []) {
  const safeChanges = changes.slice(0, 8).map((change) => (
    `${actionKind(change?.actions || change?.change?.actions)}:${safeAddressKind(change?.address)}`
  ));
  const suffix = changes.length > safeChanges.length ? ',truncated' : '';
  const diagnostic = [
    `reason=${reason}`,
    `material_count=${changes.length}`,
    `changes=${safeChanges.join(',')}${suffix || (safeChanges.length ? '' : 'none')}`,
  ].join(' ');
  throw new PlanRejectionError(reason, diagnostic);
}

function summarize(plan) {
  if (
    !plan
    || plan.complete !== true
    || plan.applyable !== true
    || plan.errored !== false
    || !Array.isArray(plan.resource_changes)
  ) {
    reject('invalid-plan');
  }
  if (Array.isArray(plan.resource_drift) && plan.resource_drift.length > 0) {
    reject('resource-drift', plan.resource_drift);
  }
  if (Array.isArray(plan.deferred_changes) && plan.deferred_changes.length > 0) {
    reject('deferred-changes');
  }

  const material = [];
  for (const change of plan.resource_changes) {
    if (change?.previous_address !== undefined) {
      reject('moved-resource', [change]);
    }
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
    reject('unexpected-change-count', material);
  }
  for (let index = 0; index < EXPECTED_CREATES.length; index += 1) {
    if (
      material[index].address !== EXPECTED_CREATES[index]
      || material[index].actions?.length !== 1
      || material[index].actions[0] !== 'create'
    ) {
      reject('unexpected-change', material);
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
  } catch (error) {
    const diagnostic = error instanceof PlanRejectionError
      ? error.diagnostic
      : 'reason=invalid-json material_count=0 changes=none';
    process.stderr.write(`::error::RR-709 plan rejected: ${diagnostic}.\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  EXPECTED_CREATES,
  PlanRejectionError,
  actionKind,
  safeAddressKind,
  summarize,
};
