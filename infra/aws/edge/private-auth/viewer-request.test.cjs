'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { handler, createViewerRequestHandler } = require('./viewer-request.cjs');
const { createSessionCookie } = require('./session-cookie.cjs');

const DEV_ID = 'E2JWU1TLDA6YRS';
const TEST_ID = 'E2IGR9MYMWVQFI';
const devSecret = 'test-only-dev-session-secret-at-least-32-bytes';
const testSecret = 'test-only-test-session-secret-at-least-32-bytes';

const devIdentity = {
  issuer: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_DEV',
  clientId: 'dev-client',
  domain: 'recruiterreply-dev.auth.us-east-1.amazoncognito.com',
  redirectUri: 'https://dev.recruiterreply.com/_auth/callback',
  logoutUri: 'https://dev.recruiterreply.com/'
};

const testIdentity = {
  issuer: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_TEST',
  clientId: 'test-client',
  domain: 'recruiterreply-test.auth.us-east-1.amazoncognito.com',
  redirectUri: 'https://test.recruiterreply.com/_auth/callback',
  logoutUri: 'https://test.recruiterreply.com/'
};

function makeEvent(uri, headers = {}, distributionId = DEV_ID) {
  return {
    Records: [{
      cf: {
        config: { distributionId, eventType: 'viewer-request' },
        request: {
          method: 'GET',
          uri,
          querystring: '',
          headers: {
            host: [{
              key: 'Host',
              value: distributionId === TEST_ID
                ? 'test.recruiterreply.com'
                : 'dev.recruiterreply.com'
            }],
            ...headers
          }
        }
      }
    }]
  };
}

function makeOriginResponseEvent(distributionId = DEV_ID, status = '200') {
  return {
    Records: [{
      cf: {
        config: { distributionId, eventType: 'origin-response' },
        request: {
          method: 'GET',
          uri: '/index.html',
          querystring: '',
          headers: {}
        },
        response: {
          status,
          statusDescription: status === '200' ? 'OK' : 'Not Found',
          headers: {
            'content-type': [{ key: 'Content-Type', value: 'text/html' }]
          }
        }
      }
    }]
  };
}

function makeSession(identity, secret, createdAt = Date.now()) {
  return createSessionCookie({
    subject: 'test-user',
    issuer: identity.issuer,
    clientId: identity.clientId
  }, secret, createdAt).value;
}

const devSession = () => makeSession(devIdentity, devSecret);
const testSession = () => makeSession(testIdentity, testSecret);

const authenticatedHandler = createViewerRequestHandler({
  [DEV_ID]: {
    sessionConfig: devIdentity,
    approvedIdentity: { ...devIdentity },
    sessionSecret: devSecret
  },
  [TEST_ID]: {
    sessionConfig: testIdentity,
    approvedIdentity: { ...testIdentity },
    sessionSecret: testSecret
  }
});

function cookieHeader(value) {
  return { cookie: [{ key: 'Cookie', value }] };
}

test('unauthenticated homepage cannot reach the origin', async () => {
  assert.equal(String((await handler(makeEvent('/'))).status), '403');
});

test('unauthenticated JavaScript asset cannot reach the origin', async () => {
  assert.equal(String((await handler(makeEvent('/assets/index.js'))).status), '403');
});

test('configured Dev origin responses receive noindex headers', async () => {
  const response = await authenticatedHandler(makeOriginResponseEvent());
  assert.equal(response.status, '200');
  assert.equal(response.headers['x-robots-tag'][0].value, 'noindex, nofollow');
  assert.equal(response.headers['content-type'][0].value, 'text/html');
});

test('configured Test error responses retain status and receive noindex headers', async () => {
  const response = await authenticatedHandler(makeOriginResponseEvent(TEST_ID, '404'));
  assert.equal(response.status, '404');
  assert.equal(response.headers['x-robots-tag'][0].value, 'noindex, nofollow');
});

test('unconfigured and unknown origin responses fail closed', async () => {
  assert.equal(String((await handler(makeOriginResponseEvent())).status), '403');
  assert.equal(String((await authenticatedHandler(
    makeOriginResponseEvent('UNKNOWN')
  )).status), '403');
});

test('malformed session cookie is rejected', async () => {
  assert.equal(String((await authenticatedHandler(
    makeEvent('/', cookieHeader('rr_session=invalid-token'))
  )).status), '403');
});

test('unknown CloudFront distribution is denied', async () => {
  assert.equal(String((await authenticatedHandler(
    makeEvent('/', {}, 'UNKNOWN')
  )).status), '403');
});

test('Production hostname is denied by private gateway', async () => {
  const event = makeEvent('/');
  event.Records[0].cf.request.headers.host = [
    { key: 'Host', value: 'recruiterreply.com' }
  ];
  assert.equal(String((await authenticatedHandler(event)).status), '403');
});

test('Test hostname on Dev distribution is denied', async () => {
  const event = makeEvent('/');
  event.Records[0].cf.request.headers.host = [
    { key: 'Host', value: 'test.recruiterreply.com' }
  ];
  assert.equal(String((await authenticatedHandler(event)).status), '403');
});

test('valid signed Dev session reaches origin after validation', async () => {
  const result = await authenticatedHandler(
    makeEvent('/dashboard', cookieHeader(`rr_session=${devSession()}`))
  );
  assert.equal(result.status, undefined);
  assert.equal(result.uri, '/index.html');
});

test('valid signed Test session reaches origin on Test distribution', async () => {
  const result = await authenticatedHandler(
    makeEvent(
      '/dashboard',
      cookieHeader(`rr_session=${testSession()}`),
      TEST_ID
    )
  );
  assert.equal(result.status, undefined);
  assert.equal(result.uri, '/index.html');
});

test('authenticated file-like paths are not rewritten', async () => {
  const result = await authenticatedHandler(
    makeEvent('/assets/index.js', cookieHeader(`rr_session=${devSession()}`))
  );
  assert.equal(result.uri, '/assets/index.js');
});

test('Dev session cannot authorize Test access', async () => {
  assert.equal(String((await authenticatedHandler(
    makeEvent('/dashboard', cookieHeader(`rr_session=${devSession()}`), TEST_ID)
  )).status), '403');
});

test('Test session cannot authorize Dev access', async () => {
  assert.equal(String((await authenticatedHandler(
    makeEvent('/dashboard', cookieHeader(`rr_session=${testSession()}`), DEV_ID)
  )).status), '403');
});

test('authenticated request does not forward session cookies to S3', async () => {
  const result = await authenticatedHandler(
    makeEvent('/dashboard', cookieHeader(`rr_session=${devSession()}`))
  );
  assert.equal(result.status, undefined);
  assert.equal(result.headers.cookie, undefined);
});

test('expired signed session is rejected', async () => {
  const expired = makeSession(devIdentity, devSecret, Date.now() - 1000000);
  assert.equal(String((await authenticatedHandler(
    makeEvent('/dashboard', cookieHeader(`rr_session=${expired}`))
  )).status), '403');
});

test('tampered session signature is rejected', async () => {
  const valid = devSession();
  const parts = valid.split('.');
  parts[1] = `${parts[1].slice(0, -1)}${parts[1].endsWith('A') ? 'B' : 'A'}`;
  assert.equal(String((await authenticatedHandler(
    makeEvent('/dashboard', cookieHeader(`rr_session=${parts.join('.')}`))
  )).status), '403');
});

test('duplicate session cookies are rejected', async () => {
  const token = devSession();
  assert.equal(String((await authenticatedHandler(
    makeEvent('/', cookieHeader(`rr_session=${token}; rr_session=${token}`))
  )).status), '403');
});

test('cookie with a different name is rejected', async () => {
  assert.equal(String((await authenticatedHandler(
    makeEvent('/', cookieHeader(`other_session=${devSession()}`))
  )).status), '403');
});

test('gateway fails closed when identity approval is missing', async () => {
  const unapproved = createViewerRequestHandler({
    [DEV_ID]: {
      sessionConfig: devIdentity,
      sessionSecret: devSecret
    }
  });
  assert.equal(String((await unapproved(
    makeEvent('/', cookieHeader(`rr_session=${devSession()}`))
  )).status), '403');
});

test('gateway fails closed when signing secret is missing', async () => {
  const unconfigured = createViewerRequestHandler({
    [DEV_ID]: {
      sessionConfig: devIdentity,
      approvedIdentity: { ...devIdentity }
    }
  });
  assert.equal(String((await unconfigured(
    makeEvent('/', cookieHeader(`rr_session=${devSession()}`))
  )).status), '403');
});

test('session signing key can be loaded from a runtime key provider', async () => {
  const withKeyProvider = createViewerRequestHandler({
    [DEV_ID]: {
      sessionConfig: devIdentity,
      approvedIdentity: { ...devIdentity },
      async getSigningKeys() {
        return { sessionSigningKey: devSecret };
      }
    }
  });

  const result = await withKeyProvider(
    makeEvent('/dashboard', cookieHeader(`rr_session=${devSession()}`))
  );

  assert.equal(result.status, undefined);
});

test('gateway fails closed when the runtime key provider fails', async () => {
  const unavailable = createViewerRequestHandler({
    [DEV_ID]: {
      sessionConfig: devIdentity,
      approvedIdentity: { ...devIdentity },
      async getSigningKeys() {
        throw new Error('Secrets Manager unavailable');
      }
    }
  });

  assert.equal(String((await unavailable(
    makeEvent('/', cookieHeader(`rr_session=${devSession()}`))
  )).status), '403');
});

test('gateway rejects ambiguous injected and runtime signing keys', async () => {
  const ambiguous = createViewerRequestHandler({
    [DEV_ID]: {
      sessionConfig: devIdentity,
      approvedIdentity: { ...devIdentity },
      sessionSecret: devSecret,
      async getSigningKeys() {
        return { sessionSigningKey: devSecret };
      }
    }
  });

  assert.equal(String((await ambiguous(
    makeEvent('/', cookieHeader(`rr_session=${devSession()}`))
  )).status), '403');
});

test('gateway fails closed when configured identity differs from approval', async () => {
  const misconfigured = createViewerRequestHandler({
    [DEV_ID]: {
      sessionConfig: { ...devIdentity, clientId: 'attacker-client' },
      approvedIdentity: { ...devIdentity },
      sessionSecret: devSecret
    }
  });
  assert.equal(String((await misconfigured(
    makeEvent('/', cookieHeader(`rr_session=${devSession()}`))
  )).status), '403');
});

function completeDevEnvironment() {
  return {
    approvedIdentity: { ...devIdentity },
    oauth: {
      domain: devIdentity.domain,
      clientId: devIdentity.clientId,
      redirectUri: devIdentity.redirectUri,
      logoutUri: devIdentity.logoutUri
    },
    tokenConfig: {
      issuer: devIdentity.issuer,
      clientId: devIdentity.clientId
    },
    sessionConfig: {
      issuer: devIdentity.issuer,
      clientId: devIdentity.clientId
    },
    async getSigningKeys() {
      return {
        sessionSigningKey: devSecret,
        transactionSigningKey: 'test-only-transaction-secret-at-least-32-bytes'
      };
    },
    replayStore: {
      async consumeOnce() {
        return true;
      }
    }
  };
}

test('complete environment redirects unauthenticated application requests to login', async () => {
  const gateway = createViewerRequestHandler({
    [DEV_ID]: completeDevEnvironment()
  });

  const response = await gateway(makeEvent('/dashboard'));

  assert.equal(response.status, '302');
  assert.equal(response.headers.location[0].value, '/_auth/login');
  assert.equal(response.headers['cache-control'][0].value, 'no-store');
});

test('login route creates a signed transaction cookie and Cognito redirect', async () => {
  const environment = completeDevEnvironment();
  const gateway = createViewerRequestHandler({ [DEV_ID]: environment }, {
    createAuthorizationRequest(config) {
      assert.equal(config.approvedIdentity, environment.approvedIdentity);
      return {
        authorizationUrl: `https://${devIdentity.domain}/oauth2/authorize?state=state`,
        transaction: {
          verifier: 'v'.repeat(43),
          state: 's'.repeat(43),
          nonce: 'n'.repeat(43),
          redirectUri: devIdentity.redirectUri
        }
      };
    }
  });

  const response = await gateway(makeEvent('/_auth/login'));

  assert.equal(response.status, '302');
  assert.match(response.headers.location[0].value, /amazoncognito\.com/);
  assert.match(response.headers['set-cookie'][0].value, /^rr_oauth_tx=/);
  assert.match(response.headers['set-cookie'][0].value, /Secure; HttpOnly; SameSite=Lax/);
});

test('callback route completes login and emits session lifecycle cookies', async () => {
  const environment = completeDevEnvironment();
  let received;
  const gateway = createViewerRequestHandler({ [DEV_ID]: environment }, {
    async completeOAuthLogin(input) {
      received = input;
      return {
        sessionCookie: 'rr_session=signed; Path=/; Secure; HttpOnly',
        clearTransactionCookie: 'rr_oauth_tx=; Path=/_auth; Max-Age=0; Secure; HttpOnly; SameSite=Lax'
      };
    }
  });
  const event = makeEvent('/_auth/callback', cookieHeader('rr_oauth_tx=signed-transaction'));
  event.Records[0].cf.request.querystring = 'code=abc123&state=def456';

  const response = await gateway(event);

  assert.equal(received.query.code, 'abc123');
  assert.equal(received.query.state, 'def456');
  assert.equal(received.transactionCookie, 'signed-transaction');
  assert.strictEqual(received.replayStore, environment.replayStore);
  assert.equal(response.status, '302');
  assert.equal(response.headers.location[0].value, '/');
  assert.equal(response.headers['set-cookie'].length, 2);
});

test('duplicate callback parameters fail closed before token exchange', async () => {
  let called = false;
  const gateway = createViewerRequestHandler({
    [DEV_ID]: completeDevEnvironment()
  }, {
    async completeOAuthLogin() {
      called = true;
    }
  });
  const event = makeEvent('/_auth/callback', cookieHeader('rr_oauth_tx=signed-transaction'));
  event.Records[0].cf.request.querystring = 'code=one&code=two&state=state';

  const originalConsoleError = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args);

  let response;
  try {
    response = await gateway(event);
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(response.status, '403');
  assert.equal(called, false);
  assert.deepEqual(logged, [[
    'PRIVATE_AUTH_CALLBACK_FAILURE',
    { reason: 'Duplicate callback parameter', errorType: 'Error' }
  ]]);
  assert.doesNotMatch(JSON.stringify(logged), /one|two|signed-transaction/);
});

test('unexpected callback failures are classified without logging sensitive details', async () => {
  const gateway = createViewerRequestHandler({
    [DEV_ID]: completeDevEnvironment()
  }, {
    async completeOAuthLogin() {
      const error = new Error('secret-code-and-token');
      error.name = 'OAuth<Token>Error';
      throw error;
    }
  });
  const event = makeEvent('/_auth/callback', cookieHeader('rr_oauth_tx=signed-transaction'));
  event.Records[0].cf.request.querystring = 'code=secret-code&state=secret-state';
  const originalConsoleError = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args);

  let response;
  try {
    response = await gateway(event);
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(response.status, '403');
  assert.deepEqual(logged, [[
    'PRIVATE_AUTH_CALLBACK_FAILURE',
    { reason: 'Unclassified callback failure', errorType: 'OAuthTokenError' }
  ]]);
  assert.doesNotMatch(JSON.stringify(logged), /secret|signed-transaction/);
});

test('logout clears local cookies and redirects to the approved Cognito logout URL', async () => {
  const gateway = createViewerRequestHandler({
    [DEV_ID]: completeDevEnvironment()
  });

  const response = await gateway(makeEvent('/_auth/logout'));
  const location = new URL(response.headers.location[0].value);

  assert.equal(response.status, '302');
  assert.equal(location.origin, `https://${devIdentity.domain}`);
  assert.equal(location.pathname, '/logout');
  assert.equal(location.searchParams.get('client_id'), devIdentity.clientId);
  assert.equal(location.searchParams.get('logout_uri'), devIdentity.logoutUri);
  assert.equal(response.headers['set-cookie'].length, 2);
});
