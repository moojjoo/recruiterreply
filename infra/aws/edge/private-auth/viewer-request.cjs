'use strict';

const { createOriginSignature } = require('./origin-signature.cjs');
const { createSessionGateway } = require('./session-gateway.cjs');
const { createAuthorizationRequest } = require('./oauth-authorize.cjs');
const { createTransactionCookie } = require('./oauth-transaction.cjs');
const { completeOAuthLogin } = require('./complete-oauth-login.cjs');
const { clearSessionCookie } = require('./session-cookie.cjs');

// Issue #356: Initial fail-closed Lambda@Edge viewer-request handler.
// Development scaffold only. Not ready for deployment.

function createViewerRequestHandler(trustedEnvironments = {}, dependencies = {}) {
  const validateSession = createSessionGateway(trustedEnvironments);
  const authorize = dependencies.createAuthorizationRequest || createAuthorizationRequest;
  const completeLogin = dependencies.completeOAuthLogin || completeOAuthLogin;

  return async function handler(event) {
    const record = event?.Records?.[0];
    const distributionId = record?.cf?.config?.distributionId;

    if (record?.cf?.response) {
      return protectOriginResponse(
        record.cf.response,
        distributionId,
        trustedEnvironments
      );
    }

    const request = record?.cf?.request;

    if (!request) {
      return forbidden();
    }

    if (record.cf.config?.eventType === 'origin-request') {
      return signApiOriginRequest(request, distributionId, trustedEnvironments);
    }

    const environments = {
      E2JWU1TLDA6YRS: 'dev.recruiterreply.com',
      E2IGR9MYMWVQFI: 'test.recruiterreply.com'
    };

    const expectedHost = environments[distributionId];
    const hostHeaders = request.headers?.host;

    if (
      !expectedHost ||
      !Array.isArray(hostHeaders) ||
      hostHeaders.length !== 1 ||
      hostHeaders[0]?.value?.toLowerCase() !== expectedHost
    ) {
      return forbidden();
    }

    const environment = trustedEnvironments[distributionId];

    if (request.uri === '/_auth/login') {
      return startAuthorization(environment, authorize);
    }

    if (request.uri === '/_auth/callback') {
      return finishAuthorization(request, environment, completeLogin);
    }

    if (request.uri === '/_auth/logout') {
      return logout(environment, expectedHost);
    }

    if (!(await validateSession(request, distributionId))) {
      return isCompleteEnvironment(environment)
        ? redirect('/_auth/login')
        : forbidden();
    }

    // API requests need the sealed session cookie so the backend can establish
    // the application identity. Static S3 requests must never receive it.
    if (!request.uri.startsWith('/api/')) delete request.headers.cookie;
    rewriteSpaRequest(request);

    return request;
  };
}

function signApiOriginRequest(request, distributionId, trustedEnvironments, now = Date.now) {
  if (distributionId !== 'E2JWU1TLDA6YRS' || !request.uri.startsWith('/api/')) {
    return request;
  }

  const environment = trustedEnvironments[distributionId];
  if (!environment?.signApiOriginRequests || typeof environment.getSigningKeys !== 'function') {
    return forbidden();
  }

  return environment.getSigningKeys().then(keys => {
    const secret = keys?.apiOriginSigningKey;
    if (typeof secret !== 'string' || Buffer.byteLength(secret) < 32) {
      return forbidden();
    }

    const timestamp = Math.floor(now() / 1000).toString();
    const signature = createOriginSignature({
      method: request.method || 'GET',
      uri: request.uri,
      querystring: request.querystring || '',
      timestamp,
      secret
    });

    request.headers = request.headers || {};
    request.headers['x-rr-origin-auth'] = [{
      key: 'X-RR-Origin-Auth',
      value: `${timestamp}.${signature}`
    }];
    return request;
  }).catch(() => forbidden());
}

function protectOriginResponse(response, distributionId, trustedEnvironments) {
  if (
    !['E2JWU1TLDA6YRS', 'E2IGR9MYMWVQFI'].includes(distributionId) ||
    !trustedEnvironments[distributionId] ||
    !response ||
    typeof response !== 'object' ||
    !response.headers ||
    typeof response.headers !== 'object'
  ) {
    return forbidden();
  }

  response.headers['x-robots-tag'] = [{
    key: 'X-Robots-Tag',
    value: 'noindex, nofollow'
  }];
  return response;
}

// Production entry point intentionally has no trusted configuration.
// It denies all requests until Cognito integration is completed.
const handler = createViewerRequestHandler();

function forbidden() {
  return {
    status: '403',
    statusDescription: 'Forbidden',
    headers: {
      'content-type': [{
        key: 'Content-Type',
        value: 'text/plain; charset=utf-8'
      }],
      'cache-control': [{
        key: 'Cache-Control',
        value: 'no-store'
      }],
      'x-robots-tag': [{
        key: 'X-Robots-Tag',
        value: 'noindex, nofollow'
      }]
    },
    body: 'Access denied'
  };
}

function isCompleteEnvironment(environment) {
  return Boolean(
    environment?.approvedIdentity &&
    environment?.oauth &&
    environment?.tokenConfig &&
    environment?.sessionConfig &&
    typeof environment?.getSigningKeys === 'function' &&
    environment?.replayStore &&
    typeof environment.replayStore.consumeOnce === 'function'
  );
}

async function getSigningKeys(environment) {
  if (!isCompleteEnvironment(environment)) {
    throw new Error('Incomplete authentication environment');
  }

  const keys = await environment.getSigningKeys();
  if (
    typeof keys?.sessionSigningKey !== 'string' ||
    Buffer.byteLength(keys.sessionSigningKey) < 32 ||
    typeof keys?.transactionSigningKey !== 'string' ||
    Buffer.byteLength(keys.transactionSigningKey) < 32
  ) {
    throw new Error('Invalid authentication signing keys');
  }

  return keys;
}

async function startAuthorization(environment, authorize) {
  try {
    const keys = await getSigningKeys(environment);
    const result = authorize({
      ...environment.oauth,
      approvedIdentity: environment.approvedIdentity
    });
    const transaction = createTransactionCookie(
      result.transaction,
      keys.transactionSigningKey
    );
    return redirect(result.authorizationUrl, [transaction.header]);
  } catch {
    return forbidden();
  }
}

async function finishAuthorization(request, environment, completeLogin) {
  try {
    const keys = await getSigningKeys(environment);
    const transactionCookie = getSingleCookie(request, 'rr_oauth_tx');
    const result = await completeLogin({
      query: parseQueryString(request.querystring),
      transactionCookie,
      transactionSecret: keys.transactionSigningKey,
      sessionSecret: keys.sessionSigningKey,
      environment,
      replayStore: environment.replayStore
    });
    return redirect('/', [
      result.sessionCookie,
      result.clearTransactionCookie
    ]);
  } catch (error) {
    const allowedErrors = new Set([
      'Missing authentication cookie',
      'Invalid callback query',
      'Duplicate callback parameter',
      'Invalid OAuth callback parameters',
      'OAuth state mismatch',
      'OAuth redirect URI mismatch',
      'OAuth token exchange failed',
      'Missing ID token'
    ]);

    const reason = allowedErrors.has(error?.message)
      ? error.message
      : 'Unclassified callback failure';

    console.error('PRIVATE_AUTH_CALLBACK_FAILURE', {
      reason,
      errorType: typeof error?.name === 'string'
        ? error.name.replace(/[^A-Za-z]/g, '').slice(0, 40)
        : 'Unknown'
    });

    return forbidden();
  }
}

function logout(environment, expectedHost) {
  if (!isCompleteEnvironment(environment)) return forbidden();

  const { domain, clientId, logoutUri } = environment.oauth;
  const approved = environment.approvedIdentity;
  const expectedLogoutUri = `https://${expectedHost}/`;

  if (
    domain !== approved.domain ||
    clientId !== approved.clientId ||
    logoutUri !== expectedLogoutUri ||
    approved.logoutUri !== expectedLogoutUri
  ) {
    return forbidden();
  }

  const url = new URL(`https://${domain}/logout`);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('logout_uri', logoutUri);

  return redirect(url.toString(), [
    clearSessionCookie(),
    'rr_oauth_tx=; Path=/_auth; Max-Age=0; Secure; HttpOnly; SameSite=Lax'
  ]);
}

function parseQueryString(querystring) {
  if (typeof querystring !== 'string' || querystring.length > 8192) {
    throw new Error('Invalid callback query');
  }

  const values = new URLSearchParams(querystring);
  const query = {};
  for (const [key, value] of values) {
    if (Object.hasOwn(query, key)) {
      throw new Error('Duplicate callback parameter');
    }
    query[key] = value;
  }
  return query;
}

function getSingleCookie(request, name) {
  const headers = request.headers?.cookie;
  if (!Array.isArray(headers) || headers.length !== 1) {
    throw new Error('Missing authentication cookie');
  }

  const matches = headers[0].value
    .split(';')
    .map(value => value.trim())
    .filter(value => value.startsWith(`${name}=`));

  if (matches.length !== 1) {
    throw new Error('Invalid authentication cookie');
  }

  const value = matches[0].slice(name.length + 1);
  if (!value) throw new Error('Invalid authentication cookie');
  return value;
}

function rewriteSpaRequest(request) {
  const leaf = request.uri.slice(request.uri.lastIndexOf('/') + 1);
  if (request.uri !== '/' && !leaf.includes('.')) {
    request.uri = '/index.html';
  }
}

function redirect(location, cookies = []) {
  const headers = {
    location: [{ key: 'Location', value: location }],
    'cache-control': [{ key: 'Cache-Control', value: 'no-store' }],
    'x-robots-tag': [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }]
  };

  if (cookies.length > 0) {
    headers['set-cookie'] = cookies.map(value => ({
      key: 'Set-Cookie',
      value
    }));
  }

  return {
    status: '302',
    statusDescription: 'Found',
    headers
  };
}

module.exports = {
  handler,
  createViewerRequestHandler,
  getSingleCookie,
  parseQueryString,
  protectOriginResponse,
  rewriteSpaRequest,
  signApiOriginRequest
};
