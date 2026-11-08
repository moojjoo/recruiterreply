'use strict';

const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const test = require('node:test');

const root = join(__dirname, '../..');
const rollback = readFileSync(join(root, 'workflows/rollback-prod.yml'), 'utf8');
const promote = readFileSync(join(root, 'workflows/promote.yml'), 'utf8');

test('rollback requires an explicit SHA confirmation', () => {
  assert.match(rollback, /target_sha:\n\s+description:/);
  assert.match(rollback, /confirmation:\n\s+description:/);
  assert.match(rollback, /confirmation !== `ROLLBACK:\$\{targetSha\}`/);
  assert.match(rollback, /has no successful Production deployment/);
  assert.match(rollback, /is already the latest successful Production release/);
});

test('rollback reuses the guarded application deployment path without database work', () => {
  assert.match(rollback, /skip_database_migration: true/);
  assert.match(rollback, /force_redeploy: true/);
  assert.match(promote, /skip_database_migration:/);
  assert.match(promote, /force_redeploy:/);
  assert.match(promote, /FORCE_REDEPLOY/);
  assert.match(promote, /inputs\.skip_database_migration != true/);
});

test('rollback keeps the shared-host serialization and production environment', () => {
  assert.match(promote, /group: recruiterreply-shared-host-promotions/);
  assert.match(rollback, /environment: prod/);
  assert.match(rollback, /uses: \.\/\.github\/workflows\/promote\.yml/);
});

test('rollback records the actual target SHA as the Production deployment identity', () => {
  assert.match(rollback, /deployments: write/);
  assert.match(rollback, /record-target-deployment:/);
  assert.match(rollback, /Record rollback target deployment identity/);
  assert.match(rollback, /ref: targetSha/);
  assert.match(rollback, /createDeploymentStatus/);
});

test('rollback callers grant deployment-write only to reusable deployment jobs', () => {
  assert.doesNotMatch(promote, /deployments: write/);
  assert.match(rollback, /record-target-deployment:[\s\S]*?deployments: write/);
});
