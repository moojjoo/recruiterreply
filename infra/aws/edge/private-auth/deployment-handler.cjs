'use strict';

const { createViewerRequestHandler } = require('./viewer-request.cjs');
const { createDynamoDbReplayStore } = require('./dynamodb-replay-store.cjs');
const { createSigningKeyProvider } = require('./secrets-manager-key-provider.cjs');

const APPROVED_HOSTS = Object.freeze({
  E2JWU1TLDA6YRS: 'dev.recruiterreply.com',
  E2IGR9MYMWVQFI: 'test.recruiterreply.com'
});

function validateString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} is required`);
  }
  return value;
}

function validateEnvironment(distributionId, config) {
  const expectedHost = APPROVED_HOSTS[distributionId];
  if (!expectedHost || !config || typeof config !== 'object') {
    throw new Error('Unapproved private environment');
  }

  const host = validateString(config.host, 'Environment host');
  const issuer = validateString(config.issuer, 'Cognito issuer');
  const clientId = validateString(config.clientId, 'Cognito client ID');
  const domain = validateString(config.domain, 'Cognito domain');
  const signingKeySecretId = validateString(
    config.signingKeySecretId,
    'Signing-key secret ID'
  );
  const replayTableName = validateString(config.replayTableName, 'Replay table name');
  const ciAuth = config.ciAuth;
  if (ciAuth !== undefined) {
    if (!ciAuth || typeof ciAuth !== 'object' || Array.isArray(ciAuth)) throw new Error('CI OIDC configuration is invalid');
    for (const [key, pattern] of [
      ['issuer', /^https:\/\/token\.actions\.githubusercontent\.com$/],
      ['audience', /^[A-Za-z0-9._:-]{3,128}$/],
      ['repository', /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/],
      ['workflowRef', /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/\.github\/workflows\/[A-Za-z0-9_.-]+\.ya?ml@refs\/heads\/[A-Za-z0-9_.-]+$/],
      ['ref', /^refs\/heads\/[A-Za-z0-9_.-]+$/],
      ['environment', /^dev$/]
    ]) {
      if (typeof ciAuth[key] !== 'string' || !pattern.test(ciAuth[key])) throw new Error(`CI OIDC ${key} is invalid`);
    }
  }
  if (typeof config.signApiOriginRequests !== 'boolean') {
    throw new Error('API origin signing flag is required');
  }
  if (config.signApiOriginRequests && distributionId !== 'E2IGR9MYMWVQFI') {
    throw new Error('API origin signing is approved for the Test distribution only');
  }

  if (host !== expectedHost) throw new Error('Environment host is not approved');
  if (!/^https:\/\/cognito-idp\.us-east-1\.amazonaws\.com\/us-east-1_[A-Za-z0-9]+$/.test(issuer)) {
    throw new Error('Cognito issuer is not approved');
  }
  if (!/^[A-Za-z0-9]{1,128}$/.test(clientId)) {
    throw new Error('Cognito client ID is not approved');
  }
  if (!/^[a-z0-9-]+\.auth\.us-east-1\.amazoncognito\.com$/.test(domain)) {
    throw new Error('Cognito domain is not approved');
  }
  if (!/^arn:aws:secretsmanager:us-east-1:[0-9]{12}:secret:[A-Za-z0-9/_+=.@-]+$/.test(signingKeySecretId)) {
    throw new Error('Signing-key secret ARN is not approved');
  }
  if (!/^[A-Za-z0-9_.-]{3,255}$/.test(replayTableName)) {
    throw new Error('Replay table name is not approved');
  }

  const redirectUri = `https://${host}/_auth/callback`;
  const logoutUri = `https://${host}/`;
  const approvedIdentity = Object.freeze({
    issuer,
    clientId,
    domain,
    redirectUri,
    logoutUri
  });

  return Object.freeze({
    approvedIdentity,
    oauth: Object.freeze({ domain, clientId, redirectUri, logoutUri }),
    tokenConfig: Object.freeze({ issuer, clientId }),
    sessionConfig: Object.freeze({ issuer, clientId }),
    ciAuth: ciAuth ? Object.freeze({...ciAuth}) : null,
    signingKeySecretId,
    signApiOriginRequests: config.signApiOriginRequests,
    replayTableName
  });
}

function createDeploymentHandler(config, dependencies = {}) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('Deployment configuration is required');
  }

  const configuredIds = Object.keys(config);
  if (configuredIds.length === 0) throw new Error('No private environments configured');
  if (configuredIds.some(id => !Object.hasOwn(APPROVED_HOSTS, id))) {
    throw new Error('Deployment includes an unapproved distribution');
  }

  const createKeyProvider = dependencies.createSigningKeyProvider || createSigningKeyProvider;
  const createReplayStore = dependencies.createDynamoDbReplayStore || createDynamoDbReplayStore;
  const createHandler = dependencies.createViewerRequestHandler || createViewerRequestHandler;

  const environments = {};
  for (const [distributionId, rawEnvironment] of Object.entries(config)) {
    const environment = validateEnvironment(distributionId, rawEnvironment);
    environments[distributionId] = Object.freeze({
      approvedIdentity: environment.approvedIdentity,
      oauth: environment.oauth,
      tokenConfig: environment.tokenConfig,
      sessionConfig: environment.sessionConfig,
      ciAuth: environment.ciAuth,
      getSigningKeys: createKeyProvider({
        secretId: environment.signingKeySecretId,
        region: 'us-east-1'
      }),
      signApiOriginRequests: environment.signApiOriginRequests,
      replayStore: createReplayStore({
        tableName: environment.replayTableName,
        region: 'us-east-1'
      })
    });
  }

  return createHandler(Object.freeze(environments));
}

module.exports = {
  APPROVED_HOSTS,
  createDeploymentHandler,
  validateEnvironment
};
