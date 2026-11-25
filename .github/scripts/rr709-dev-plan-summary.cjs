'use strict';

const { isDeepStrictEqual } = require('node:util');

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
  const kinds = {
    'no-op': 'no-op',
    read: 'read',
    create: 'create',
    update: 'update',
    delete: 'delete',
    'delete,create': 'replace',
    'create,delete': 'replace',
  };
  return Object.hasOwn(kinds, key) ? kinds[key] : 'unknown';
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

// Do not derive labels from addresses or provider data. Only these source-backed
// exact addresses (or finite expansions of their checked-in environment keys)
// can receive an environment and component label.
const DRIFT_COMPONENTS = new Map([
  ['aws_iam_role.terraform_audit', ['shared', 'audit-role', 'iam']],
  ['module.github_oidc.aws_iam_role.github_actions', ['shared', 'deployment-role', 'iam']],
  ['module.frontend.aws_route53_record.prod_www["A"]', ['prod', 'frontend-dns', 'dns']],
  ['module.frontend.aws_route53_record.prod_www["AAAA"]', ['prod', 'frontend-dns', 'dns']],
]);

for (const env of ['dev', 'test', 'prod']) {
  const key = JSON.stringify(env);
  for (const client of ['bff', 'ci', 'worker', 'ops']) {
    DRIFT_COMPONENTS.set(
      `module.cognito_bff[${key}].aws_cognito_user_pool_client.${client}`,
      [env, `app-auth-${client}`, 'cognito'],
    );
  }
  DRIFT_COMPONENTS.set(
    `module.private_environment_identity[${key}].aws_cognito_user_pool_client.browser`,
    [env, 'environment-gate', 'cognito'],
  );
  DRIFT_COMPONENTS.set(
    `module.frontend.aws_cloudfront_distribution.this[${key}]`,
    [env, 'frontend-distribution', 'edge-distribution'],
  );
  DRIFT_COMPONENTS.set(
    `module.frontend.aws_cloudfront_function.spa_router[${key}]`,
    [env, 'spa-router', 'edge-function'],
  );
  if (env !== 'prod') {
    DRIFT_COMPONENTS.set(
      `module.frontend.aws_cloudfront_function.noindex[${key}]`,
      [env, 'noindex', 'edge-function'],
    );
  }
}

const DRIFT_FAMILIES = new Map([
  ['aws_iam_role', 'iam'],
  ['aws_cognito_user_pool_client', 'cognito'],
  ['aws_cloudfront_distribution', 'edge-distribution'],
  ['aws_cloudfront_function', 'edge-function'],
  ['aws_route53_record', 'dns'],
]);

const FIELD_CATEGORIES = new Map(Object.entries({
  iam: {
    assume_role_policy: 'trust', managed_policy_arns: 'permissions',
    inline_policy: 'permissions', permissions_boundary: 'permissions',
    tags: 'tags', tags_all: 'tags',
  },
  cognito: {
    callback_urls: 'redirects', logout_urls: 'redirects', default_redirect_uri: 'redirects',
    explicit_auth_flows: 'auth-flow', allowed_oauth_flows: 'auth-flow',
    allowed_oauth_scopes: 'auth-flow', allowed_oauth_flows_user_pool_client: 'auth-flow',
    supported_identity_providers: 'providers', read_attributes: 'attribute-access',
    write_attributes: 'attribute-access', token_validity_units: 'token-lifetime',
    access_token_validity: 'token-lifetime', id_token_validity: 'token-lifetime',
    refresh_token_validity: 'token-lifetime', prevent_user_existence_errors: 'account-response',
  },
  'edge-distribution': {
    aliases: 'routing', origin: 'routing', origin_group: 'routing',
    default_cache_behavior: 'cache-or-association', ordered_cache_behavior: 'cache-or-association',
    viewer_certificate: 'tls', enabled: 'availability', tags: 'tags', tags_all: 'tags',
  },
  'edge-function': {code: 'function-configuration', runtime: 'function-configuration',
    publish: 'function-configuration', key_value_store_associations: 'function-configuration'},
  dns: {alias: 'record-target', records: 'record-target', ttl: 'record-lifetime',
    weighted_routing_policy: 'routing-policy', failover_routing_policy: 'routing-policy'},
}));

function settingCategories(change, family) {
  const { before, after } = change?.change ?? {};
  const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  if (!isObject(before) || !isObject(after)) return ['detail-unavailable'];
  const mapping = FIELD_CATEGORIES.get(family) ?? {};
  const categories = new Set();
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (Object.hasOwn(before, key) !== Object.hasOwn(after, key)
      || !isDeepStrictEqual(before[key], after[key])) {
      categories.add(Object.hasOwn(mapping, key) ? mapping[key] : 'other-setting');
    }
  }
  return categories.size ? [...categories].sort() : ['no-value-difference'];
}

function rejectDrift(changes) {
  const groups = new Map();
  let unknownScopeCount = 0;
  for (const change of changes) {
    const known = change?.mode === 'managed' ? DRIFT_COMPONENTS.get(change.address) : undefined;
    const family = known?.[2] ?? DRIFT_FAMILIES.get(change?.type) ?? 'unknown-family';
    const [scope, component] = known ?? ['unknown-scope', 'unmapped-component'];
    if (!known) unknownScopeCount += 1;
    const action = actionKind(change?.change?.actions);
    const key = [action, scope, component, family].join(':');
    if (!groups.has(key)) groups.set(key, { count: 0, categories: new Set() });
    const group = groups.get(key);
    group.count += 1;
    for (const category of settingCategories(change, family)) group.categories.add(category);
  }
  const rows = [...groups].sort(([left], [right]) => left.localeCompare(right));
  const visible = rows.slice(0, 16);
  const hiddenCount = rows.slice(visible.length).reduce((sum, [, group]) => sum + group.count, 0);
  const diagnostic = [
    'reason=resource-drift',
    `drift_count=${changes.length}`,
    `unknown_scope_count=${unknownScopeCount}`,
    `omitted_entry_count=${hiddenCount}`,
    `groups=${visible.map(([key, group]) => (
      `${key}:${group.count}:${[...group.categories].sort().join('+')}`
    )).join(',')}`,
  ].join(' ');
  throw new PlanRejectionError('resource-drift', diagnostic);
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
    rejectDrift(plan.resource_drift);
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
