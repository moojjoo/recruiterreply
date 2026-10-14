'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const https = require('node:https');
const { fetchJwks } = require('./fetch-jwks.cjs');

test('untrusted Cognito issuers are rejected without network access', async () => {
  const originalGet = https.get;
  let networkCalled = false;

  https.get = () => {
    networkCalled = true;
    throw new Error('Network access must not occur');
  };

  try {
    const invalidIssuers = [
      '',
      null,
      undefined,
      'http://cognito-idp.us-east-1.amazonaws.com/us-east-1_DEV',
      'https://evil.example.com/us-east-1_DEV',
      'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_DEV',
      'https://cognito-idp.us-east-1.amazonaws.com.evil.com/us-east-1_DEV',
      'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_DEV/extra',
      'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_DEV?redirect=evil'
    ];

    for (const issuer of invalidIssuers) {
      await assert.rejects(fetchJwks(issuer, { trustedIssuer: issuer }), /Untrusted Cognito issuer/);
    }

    assert.equal(networkCalled, false);
  } finally {
    https.get = originalGet;
  }
});

test('valid Cognito JWKS is retrieved and cached', async () => {
  const { EventEmitter } = require('node:events');
  const originalGet = https.get;
  const issuer = 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_CACHE';
  const expected = { keys: [{ kid: 'cache-test-key' }] };
  let requests = 0;

  https.get = (url, options, callback) => {
    requests++;

    assert.equal(url, `${issuer}/.well-known/jwks.json`);
    assert.equal(options.timeout, 3000);

    const request = new EventEmitter();
    request.destroy = () => {};

    const response = new EventEmitter();
    response.statusCode = 200;

    process.nextTick(() => {
      callback(response);
      response.emit('data', Buffer.from(JSON.stringify(expected)));
      response.emit('end');
    });

    return request;
  };

  try {
    const first = await fetchJwks(issuer, { trustedIssuer: issuer });
    const second = await fetchJwks(issuer, { trustedIssuer: issuer });

    assert.deepEqual(first, expected);
    assert.deepEqual(second, expected);
    assert.equal(requests, 1, 'JWKS should be fetched only once');
  } finally {
    https.get = originalGet;
  }
});

test('JWKS retrieval rejects when HTTPS request times out', async () => {
  const { EventEmitter } = require('node:events');
  const originalGet = https.get;
  const issuer = 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_TIMEOUT';

  https.get = (url, options) => {
    assert.equal(options.timeout, 3000);

    const request = new EventEmitter();

    request.destroy = error => {
      process.nextTick(() => request.emit('error', error));
    };

    process.nextTick(() => request.emit('timeout'));

    return request;
  };

  try {
    await assert.rejects(
      fetchJwks(issuer, { trustedIssuer: issuer }),
      /JWKS request timed out/
    );
  } finally {
    https.get = originalGet;
  }
});

test('JWKS responses larger than 64 KB are rejected', async () => {
  const { EventEmitter } = require('node:events');
  const originalGet = https.get;
  const issuer = 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_OVERSIZE';

  https.get = (url, options, callback) => {
    const request = new EventEmitter();
    request.destroy = error => {
      process.nextTick(() => request.emit('error', error));
    };

    const response = new EventEmitter();
    response.statusCode = 200;
    response.destroy = error => {
      process.nextTick(() => response.emit('error', error));
    };

    process.nextTick(() => {
      callback(response);
      response.emit('data', Buffer.alloc(65537, 'x'));
    });

    return request;
  };

  try {
    await assert.rejects(
      fetchJwks(issuer, { trustedIssuer: issuer }),
      /JWKS response too large/
    );
  } finally {
    https.get = originalGet;
  }
});

test('malformed JWKS JSON is rejected and not cached', async () => {
  const { EventEmitter } = require('node:events');
  const originalGet = https.get;
  const issuer = 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_BADJSON';
  let requests = 0;

  https.get = (url, options, callback) => {
    requests++;

    const request = new EventEmitter();
    request.destroy = () => {};

    const response = new EventEmitter();
    response.statusCode = 200;

    process.nextTick(() => {
      callback(response);
      response.emit('data', Buffer.from('{invalid-json'));
      response.emit('end');
    });

    return request;
  };

  try {
    await assert.rejects(fetchJwks(issuer, { trustedIssuer: issuer }), SyntaxError);
    await assert.rejects(fetchJwks(issuer, { trustedIssuer: issuer }), SyntaxError);

    assert.equal(requests, 2, 'Malformed JWKS must not be cached');
  } finally {
    https.get = originalGet;
  }
});

test('JWKS without a keys array is rejected', async () => {
  const { EventEmitter } = require('node:events');
  const originalGet = https.get;
  const issuer = 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_BADKEYS';

  https.get = (url, options, callback) => {
    const request = new EventEmitter();
    request.destroy = () => {};

    const response = new EventEmitter();
    response.statusCode = 200;

    process.nextTick(() => {
      callback(response);
      response.emit('data', Buffer.from(JSON.stringify({ keys: 'invalid' })));
      response.emit('end');
    });

    return request;
  };

  try {
    await assert.rejects(fetchJwks(issuer, { trustedIssuer: issuer }), /Invalid JWKS/);
  } finally {
    https.get = originalGet;
  }
});

test('JWKS HTTP failures are rejected and not cached', async () => {
  const { EventEmitter } = require('node:events');
  const originalGet = https.get;
  const issuer = 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_HTTPFAIL';
  let requests = 0;

  https.get = (url, options, callback) => {
    requests++;

    const request = new EventEmitter();
    request.destroy = () => {};

    const response = new EventEmitter();
    response.statusCode = requests === 1 ? 403 : 500;
    response.resume = () => {};

    process.nextTick(() => callback(response));

    return request;
  };

  try {
    await assert.rejects(fetchJwks(issuer, { trustedIssuer: issuer }), /JWKS retrieval failed/);
    await assert.rejects(fetchJwks(issuer, { trustedIssuer: issuer }), /JWKS retrieval failed/);

    assert.equal(requests, 2, 'HTTP failures must not be cached');
  } finally {
    https.get = originalGet;
  }
});

test('JWKS HTTPS network failures are rejected', async () => {
  const { EventEmitter } = require('node:events');
  const originalGet = https.get;
  const issuer = 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_NETFAIL';

  https.get = () => {
    const request = new EventEmitter();

    process.nextTick(() => {
      const error = new Error('Connection refused');
      error.code = 'ECONNREFUSED';
      request.emit('error', error);
    });

    return request;
  };

  try {
    await assert.rejects(
      fetchJwks(issuer, { trustedIssuer: issuer }),
      error => error.code === 'ECONNREFUSED'
    );
  } finally {
    https.get = originalGet;
  }
});

test('expired JWKS cache triggers a fresh HTTPS request', async () => {
  const { EventEmitter } = require('node:events');
  const originalGet = https.get;
  const originalNow = Date.now;
  const issuer = 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_EXPIRY';
  let currentTime = 1800000000000;
  let requests = 0;

  Date.now = () => currentTime;

  https.get = (url, options, callback) => {
    requests++;

    const request = new EventEmitter();
    request.destroy = () => {};

    const response = new EventEmitter();
    response.statusCode = 200;

    process.nextTick(() => {
      callback(response);
      response.emit('data', Buffer.from(JSON.stringify({
        keys: [{ kid: `key-${requests}` }]
      })));
      response.emit('end');
    });

    return request;
  };

  try {
    const first = await fetchJwks(issuer, { trustedIssuer: issuer });

    currentTime += 299999;
    const cached = await fetchJwks(issuer, { trustedIssuer: issuer });

    assert.deepEqual(cached, first);
    assert.equal(requests, 1);

    currentTime += 1;
    const refreshed = await fetchJwks(issuer, { trustedIssuer: issuer });

    assert.equal(requests, 2);
    assert.equal(refreshed.keys[0].kid, 'key-2');
  } finally {
    Date.now = originalNow;
    https.get = originalGet;
  }
});

test('valid-looking but untrusted Cognito pool is rejected', async () => {
  const issuer =
    'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ATTACKER';

  const trustedIssuer =
    'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_TRUSTED';

  await assert.rejects(
    fetchJwks(issuer, { trustedIssuer }),
    /Untrusted Cognito issuer/
  );
});

test('missing trusted issuer configuration fails closed without HTTPS', async () => {
  const issuer =
    'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_MISSING';

  const originalGet = https.get;
  let networkCalled = false;

  https.get = () => {
    networkCalled = true;
    throw new Error('Unexpected HTTPS request');
  };

  try {
    await assert.rejects(
      fetchJwks(issuer),
      /Untrusted Cognito issuer/
    );

    assert.equal(networkCalled, false);
  } finally {
    https.get = originalGet;
  }
});
