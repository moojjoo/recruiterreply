'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const https = require('node:https');
const { EventEmitter } = require('node:events');

const {
  exchangeAuthorizationCode
} = require('./oauth-token-exchange.cjs');

const config = {
  domain: 'recruiterreply-dev.auth.us-east-1.amazoncognito.com',
  approvedDomain: 'recruiterreply-dev.auth.us-east-1.amazoncognito.com',
  clientId: 'DevClient123',
  approvedClientId: 'DevClient123',
  redirectUri: 'https://dev.recruiterreply.com/_auth/callback',
  approvedRedirectUri: 'https://dev.recruiterreply.com/_auth/callback',
  code: 'test.authorization-code',
  verifier: 'A'.repeat(43)
};

test('unapproved token endpoint is rejected without network access', async () => {
  const originalRequest = https.request;
  let called = false;
  https.request = () => {
    called = true;
    throw new Error('Unexpected network request');
  };

  try {
    await assert.rejects(
      exchangeAuthorizationCode({
        ...config,
        domain: 'attacker.auth.us-east-1.amazoncognito.com'
      }),
      /Untrusted OAuth token exchange configuration/
    );
    assert.equal(called, false);
  } finally {
    https.request = originalRequest;
  }
});

test('token exchange sends authorization code and PKCE verifier', async () => {
  const originalRequest = https.request;
  let requestOptions;
  let requestBody = '';

  https.request = (options, callback) => {
    requestOptions = options;

    const request = new EventEmitter();
    request.setTimeout = () => request;
    request.write = chunk => { requestBody += chunk; };
    request.end = chunk => {
      if (chunk) requestBody += chunk;

      const response = new EventEmitter();
      response.statusCode = 200;

      process.nextTick(() => {
        callback(response);
        response.emit('data', Buffer.from(JSON.stringify({
          id_token: 'mock.id.token',
          access_token: 'mock-access-token',
          token_type: 'Bearer',
          expires_in: 900
        })));
        response.emit('end');
      });
    };
    request.destroy = error => {
      if (error) process.nextTick(() => request.emit('error', error));
    };

    return request;
  };

  try {
    const tokens = await exchangeAuthorizationCode(config);

    assert.equal(requestOptions.hostname, config.domain);
    assert.equal(requestOptions.path, '/oauth2/token');
    assert.equal(requestOptions.method, 'POST');

    const body = new URLSearchParams(requestBody);
    assert.equal(body.get('grant_type'), 'authorization_code');
    assert.equal(body.get('client_id'), config.clientId);
    assert.equal(body.get('code'), config.code);
    assert.equal(body.get('code_verifier'), config.verifier);
    assert.equal(body.get('redirect_uri'), config.redirectUri);
    assert.equal(tokens.id_token, 'mock.id.token');
  } finally {
    https.request = originalRequest;
  }
});

test('non-200 token response is rejected', async () => {
  const originalRequest = https.request;

  https.request = (options, callback) => {
    const request = new EventEmitter();
    request.write = () => {};
    request.end = () => {
      const response = new EventEmitter();
      response.statusCode = 400;
      response.resume = () => {};

      process.nextTick(() => {
        callback(response);
        response.emit('data', Buffer.from('invalid_grant'));
        response.emit('end');
      });
    };
    request.destroy = error => {
      if (error) process.nextTick(() => request.emit('error', error));
    };

    return request;
  };

  try {
    await assert.rejects(
      exchangeAuthorizationCode(config),
      /OAuth token exchange failed/
    );
  } finally {
    https.request = originalRequest;
  }
});

test('malformed token response is rejected', async () => {
  const originalRequest = https.request;

  https.request = (options, callback) => {
    const request = new EventEmitter();
    request.write = () => {};
    request.end = () => {
      const response = new EventEmitter();
      response.statusCode = 200;

      process.nextTick(() => {
        callback(response);
        response.emit('data', Buffer.from('not-json'));
        response.emit('end');
      });
    };
    request.destroy = error => {
      if (error) process.nextTick(() => request.emit('error', error));
    };

    return request;
  };

  try {
    await assert.rejects(
      exchangeAuthorizationCode(config),
      /Invalid OAuth token response/
    );
  } finally {
    https.request = originalRequest;
  }
});
