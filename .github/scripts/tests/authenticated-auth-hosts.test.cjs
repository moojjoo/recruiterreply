'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { approvedAuthenticationHosts } = require('../authenticated-auth-hosts.cjs');

const prefix = 'synthetic-dev.auth.us-east-1.amazoncognito.com';
const native = 'app-auth-dev.recruiterreply.com';

test('keeps the gate prefix and adds the exact Dev native application host', () => {
  assert.deepEqual([...approvedAuthenticationHosts(prefix, native, 'dev')], [prefix, native]);
});

test('preserves the existing gate-only allowlist when native app host is absent', () => {
  assert.deepEqual([...approvedAuthenticationHosts(prefix, '', 'dev')], [prefix]);
});

test('rejects missing or malformed gate prefix hosts', () => {
  assert.throws(() => approvedAuthenticationHosts('', native, 'dev'));
  assert.throws(() => approvedAuthenticationHosts('app-auth-dev.recruiterreply.com', native, 'dev'));
});

test('rejects alternate custom hosts and any custom host in Test', () => {
  assert.throws(() => approvedAuthenticationHosts(prefix, 'other.recruiterreply.com', 'dev'));
  assert.throws(() => approvedAuthenticationHosts(prefix, native, 'test'));
});
