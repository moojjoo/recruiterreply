'use strict';

const assert = require('node:assert/strict');

const prefixDomainPattern = /^[a-z0-9-]+\.auth\.[a-z0-9-]+\.amazoncognito\.com$/;
const approvedDevNativeAppHost = 'app-auth-dev.recruiterreply.com';

function approvedAuthenticationHosts(prefixHostsValue, nativeAppHostValue, environment) {
  const prefixHosts = (prefixHostsValue || '')
    .split(',')
    .map(host => host.trim())
    .filter(Boolean);
  assert(prefixHosts.length > 0,
    'PLAYWRIGHT_ALLOWED_AUTH_HOSTS must contain exact approved Cognito prefix hostnames.');
  for (const host of prefixHosts) {
    assert.match(host, prefixDomainPattern,
      'PLAYWRIGHT_ALLOWED_AUTH_HOSTS contains an invalid Cognito prefix hostname.');
  }

  const nativeAppHost = (nativeAppHostValue || '').trim();
  if (nativeAppHost) {
    assert.equal(environment, 'dev', 'Native application auth hostname is approved only for Dev.');
    assert.equal(nativeAppHost, approvedDevNativeAppHost,
      'Native application auth hostname does not match the exact approved Dev hostname.');
  }

  return new Set(nativeAppHost ? [...prefixHosts, nativeAppHost] : prefixHosts);
}

module.exports = { approvedAuthenticationHosts };
