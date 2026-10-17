'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  APPROVED_HOSTS,
  createDeploymentHandler,
  validateEnvironment
} = require('./deployment-handler.cjs');

function devConfig(overrides = {}) {
  return {
    host: 'dev.recruiterreply.com',
    issuer: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_DEV123',
    clientId: 'devclient123',
    domain: 'recruiterreply-dev.auth.us-east-1.amazoncognito.com',
    signingKeySecretId: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:dev',
    replayTableName: 'recruiterreply-dev-oauth-replay',
    signApiOriginRequests: false,
    ...overrides
  };
}

test('builds a private environment with derived callback and logout URLs', () => {
  const environment = validateEnvironment('E2JWU1TLDA6YRS', devConfig());

  assert.equal(environment.approvedIdentity.redirectUri, 'https://dev.recruiterreply.com/_auth/callback');
  assert.equal(environment.approvedIdentity.logoutUri, 'https://dev.recruiterreply.com/');
  assert.equal(environment.oauth.redirectUri, environment.approvedIdentity.redirectUri);
});

test('rejects Production and unknown CloudFront distributions', () => {
  for (const distributionId of ['EHWW9BKSSF64L', 'UNKNOWN']) {
    assert.throws(
      () => validateEnvironment(distributionId, devConfig()),
      /Unapproved private environment/
    );
  }
});

test('rejects a host that does not match the approved distribution', () => {
  assert.throws(
    () => validateEnvironment('E2JWU1TLDA6YRS', devConfig({ host: 'test.recruiterreply.com' })),
    /host is not approved/
  );
});

test('rejects API origin signing on Dev', () => {
  assert.throws(
    () => validateEnvironment('E2JWU1TLDA6YRS', devConfig({ signApiOriginRequests: true })),
    /Test distribution only/
  );
});

test('rejects Cognito identities outside us-east-1 approved formats', () => {
  assert.throws(
    () => validateEnvironment('E2JWU1TLDA6YRS', devConfig({
      issuer: 'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_DEV'
    })),
    /issuer is not approved/
  );
  assert.throws(
    () => validateEnvironment('E2JWU1TLDA6YRS', devConfig({ domain: 'example.com' })),
    /domain is not approved/
  );
  assert.throws(
    () => validateEnvironment('E2JWU1TLDA6YRS', devConfig({ clientId: 'not a client' })),
    /client ID is not approved/
  );
});

test('rejects unsafe runtime resource identifiers', () => {
  assert.throws(
    () => validateEnvironment('E2JWU1TLDA6YRS', devConfig({
      signingKeySecretId: 'this-is-a-secret-value-not-an-arn'
    })),
    /secret ARN is not approved/
  );
  assert.throws(
    () => validateEnvironment('E2JWU1TLDA6YRS', devConfig({
      signingKeySecretId: 'arn:aws:secretsmanager:us-west-2:123456789012:secret:dev'
    })),
    /secret ARN is not approved/
  );
  assert.throws(
    () => validateEnvironment('E2JWU1TLDA6YRS', devConfig({ replayTableName: 'no spaces' })),
    /table name is not approved/
  );
});

test('constructs narrowly configured runtime adapters and viewer handler', () => {
  const calls = [];
  const expectedHandler = async () => ({ status: '403' });
  const handler = createDeploymentHandler({ E2JWU1TLDA6YRS: devConfig() }, {
    createSigningKeyProvider(input) {
      calls.push(['secret', input]);
      return async () => ({ sessionSigningKey: 's', transactionSigningKey: 't' });
    },
    createDynamoDbReplayStore(input) {
      calls.push(['table', input]);
      return { consumeOnce: async () => true };
    },
    createViewerRequestHandler(environments) {
      calls.push(['handler', environments]);
      return expectedHandler;
    }
  });

  assert.equal(handler, expectedHandler);
  assert.deepEqual(calls[0], ['secret', {
    secretId: devConfig().signingKeySecretId,
    region: 'us-east-1'
  }]);
  assert.deepEqual(calls[1], ['table', {
    tableName: devConfig().replayTableName,
    region: 'us-east-1'
  }]);
  assert.equal(calls[2][1].E2JWU1TLDA6YRS.approvedIdentity.clientId, 'devclient123');
});

test('rejects empty configuration and mixed-in Production configuration', () => {
  assert.throws(() => createDeploymentHandler({}), /No private environments configured/);
  assert.throws(
    () => createDeploymentHandler({
      E2JWU1TLDA6YRS: devConfig(),
      EHWW9BKSSF64L: devConfig({ host: 'recruiterreply.com' })
    }),
    /unapproved distribution/
  );
});

test('approved distribution map contains Dev and Test only', () => {
  assert.deepEqual(APPROVED_HOSTS, {
    E2JWU1TLDA6YRS: 'dev.recruiterreply.com',
    E2IGR9MYMWVQFI: 'test.recruiterreply.com'
  });
});
