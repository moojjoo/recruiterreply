'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {analyzeMigrationSql, evaluateMigration, validateAuthorization} = require('../migration-gate.cjs');

const sha = 'a'.repeat(40);
const digest = `sha256:${'b'.repeat(64)}`;

test('additive migration SQL is classified as non-destructive', () => {
  assert.equal(analyzeMigrationSql('CREATE TABLE example (id uuid PRIMARY KEY);').destructive, false);
});

test('destructive SQL is detected', () => {
  assert.equal(analyzeMigrationSql('ALTER TABLE users DROP COLUMN email;').destructive, true);
  assert.equal(analyzeMigrationSql('TRUNCATE TABLE users;').destructive, true);
});

test('authorization is exact and SHA-bound', () => {
  assert.equal(validateAuthorization({sha, digest, authorization:`${sha}:${digest}`}).authorized, true);
  assert.equal(validateAuthorization({sha, digest, authorization:`${'c'.repeat(40)}:${digest}`}).authorized, false);
});

test('migration gate refuses missing or mismatched authorization', () => {
  assert.throws(() => evaluateMigration({sha, digest, sql:'CREATE TABLE example (id int);'}), /Migration approval required/);
  assert.throws(() => evaluateMigration({sha, digest, sql:'CREATE TABLE example (id int);', authorization:`${sha}:sha256:${'c'.repeat(64)}`}), /does not match/);
});

test('migration gate returns an auditable approval record', () => {
  const result = evaluateMigration({sha, digest, sql:'CREATE TABLE example (id int);', authorization:`${sha}:${digest}`});
  assert.deepEqual(result, {sha, digest, destructive:false, matches:[], authorized:true});
});
