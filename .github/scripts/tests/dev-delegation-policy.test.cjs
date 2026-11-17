'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const policy = require('../dev-delegation-policy.cjs');
const disabled = require('../../config/dev-delegation-policy.json');

const active = {
  ...disabled, enabled:true, controlIssueNumber:704,
  githubApp:{appId:101, installationId:202, botUserId:303, botLogin:'recruiterreply-guru[bot]'}
};

test('checked-in policy is explicitly inert and has no live identity', () => {
  assert.equal(disabled.enabled, false);
  assert.deepEqual(disabled.githubApp, {appId:null, installationId:null, botUserId:null, botLogin:null});
  const result = policy.validateConfiguration(disabled);
  assert.equal(result.valid, false);
  assert.match(result.reasons.join('; '), /disabled/);
});

test('commands are exact, SHA-bound, and do not recognize Test or Production', () => {
  assert.deepEqual(policy.parseOwnerGrantCommand('/grant-guru-dev 8h 5'), {hours:8, successfulMerges:5});
  assert.deepEqual(policy.parseOwnerGrantCommand('/grant-guru-dev 9h 5'), {hours:9, successfulMerges:5});
  assert.deepEqual(policy.parseDelegatedCommand(`/guru-execute-dev 704 ${'a'.repeat(40)} gd_0123456789abcdef`), {
    issueNumber:704, headSha:'a'.repeat(40), grantId:'gd_0123456789abcdef'
  });
  assert.equal(policy.parseDelegatedCommand(`/guru-execute-test 704 ${'a'.repeat(40)} gd_0123456789abcdef`), null);
  assert.equal(policy.parseDelegatedCommand(`/guru-execute-prod 704 ${'a'.repeat(40)} gd_0123456789abcdef`), null);
  assert.equal(policy.parseDelegatedCommand('/guru-execute-dev 704 main gd_0123456789abcdef'), null);
});

test('identity requires every pinned machine identifier and repository', () => {
  const input = {
    repository:active.repository,
    actor:{type:'Bot', id:303, login:'recruiterreply-guru[bot]'},
    comment:{performed_via_github_app:{id:101}}, installation:{id:202}
  };
  assert.equal(policy.verifyAppIdentity(input, active).valid, true);
  for (const mutation of [
    {actor:{...input.actor, type:'User'}},
    {actor:{...input.actor, id:304}},
    {actor:{...input.actor, login:'moojjoo'}},
    {comment:{}}, {comment:{performed_via_github_app:{id:999}}},
    {installation:{}}, {installation:{id:999}}, {repository:'attacker/fork'}
  ]) {
    assert.equal(policy.verifyAppIdentity({...input, ...mutation}, active).valid, false);
  }
  assert.equal(policy.verifyAppIdentity(input, {...active, githubApp:{}}).valid, false);
  assert.equal(policy.verifyAppIdentity(input, {...active, limits:{...active.limits, maxChangedLines:undefined}}).valid, false);
});

test('delegated scope denies sensitive, destructive, binary, and oversized changes', () => {
  const limits = active.limits;
  assert.equal(policy.classifyDelegatedChange([{filename:'frontend/src/Card.tsx',status:'modified',additions:4,deletions:2,patch:'@@'}], limits).eligible, true);
  for (const file of [
    {filename:'.github/workflows/build.yml',status:'modified',patch:'@@'},
    {filename:'backend/Auth/Login.cs',status:'modified',patch:'@@'},
    {filename:'frontend/src/services/authMode.ts',status:'modified',additions:1,deletions:0,patch:'@@'},
    {filename:'frontend/src/services/api/billingService.ts',status:'modified',additions:1,deletions:0,patch:'@@'},
    {filename:'frontend/src/security.ts',status:'modified',additions:1,deletions:0,patch:'@@'},
    {filename:'backend/Services/CognitoBffService.cs',status:'modified',additions:1,deletions:0,patch:'@@'},
    {filename:'backend/Services/JwtTokenService.cs',status:'modified',additions:1,deletions:0,patch:'@@'},
    {filename:'backend/Services/PasswordHashService.cs',status:'modified',additions:1,deletions:0,patch:'@@'},
    {filename:'backend/Middleware/BffCsrfMiddleware.cs',status:'modified',additions:1,deletions:0,patch:'@@'},
    {filename:'frontend/package-lock.json',status:'modified',patch:'@@'},
    {filename:'frontend/src/Card.tsx',status:'removed',patch:'@@'},
    {filename:'frontend/src/logo.png',status:'modified',patch:null}
  ]) assert.equal(policy.classifyDelegatedChange([file], limits).eligible, false, file.filename);
  assert.equal(policy.classifyDelegatedChange([{filename:'frontend/src/Card.tsx',status:'modified',additions:1201,deletions:0,patch:'@@'}], limits).eligible, false);
  assert.equal(policy.classifyDelegatedChange([{filename:'frontend/src/Card.tsx',status:'changed',additions:1,deletions:0,patch:'@@'}], limits).eligible, false);
  assert.equal(policy.classifyDelegatedChange([{filename:'frontend/src/Card.tsx',status:'modified',additions:NaN,deletions:0,patch:'@@'}], limits).eligible, false);
  assert.equal(policy.classifyDelegatedChange([{filename:'frontend/src/Card.tsx',status:'modified',additions:1,deletions:0,patch:'@@'}], {...limits, maxChangedFiles:undefined}).eligible, false);
});

test('grant bounds, expiry, revocation, and issuer fail closed', () => {
  const now = Date.parse('2026-11-17T00:00:00Z');
  const grant = policy.createGrant({repository:active.repository, ownerLogin:'moojjoo', hours:8, successfulMerges:5, issuedAt:now, nonce:'0123456789abcdef'}, active);
  assert.equal(policy.validateGrant({grant, repository:active.repository, ownerLogin:'moojjoo', grantId:grant.grantId, now:now + 1}).valid, true);
  assert.equal(policy.validateGrant({grant, repository:active.repository, ownerLogin:'mallory', grantId:grant.grantId, now:now + 1}).valid, false);
  assert.equal(policy.validateGrant({grant, repository:active.repository, ownerLogin:'moojjoo', grantId:grant.grantId, now:now + 8 * 3600000}).valid, false);
  assert.equal(policy.validateGrant({grant:{...grant, revokedAt:new Date(now + 1000).toISOString()}, repository:active.repository, ownerLogin:'moojjoo', grantId:grant.grantId, now:now + 2000}).valid, false);
  assert.equal(policy.validateGrant({grant:{...grant, reservations:null}, repository:active.repository, ownerLogin:'moojjoo', grantId:grant.grantId, now:now + 1}).valid, false);
  assert.throws(() => policy.createGrant({repository:active.repository, ownerLogin:'moojjoo', hours:9, successfulMerges:1, issuedAt:now, nonce:'0123456789abcdef'}, active));
  assert.throws(() => policy.createGrant({repository:active.repository, ownerLogin:'moojjoo', hours:1, successfulMerges:6, issuedAt:now, nonce:'0123456789abcdef'}, active));
});

test('quota reservations are idempotent, scope-bound, and include pending merges', () => {
  const now = Date.parse('2026-11-17T00:00:00Z');
  let grant = policy.createGrant({repository:active.repository, ownerLogin:'moojjoo', hours:8, successfulMerges:2, issuedAt:now, nonce:'0123456789abcdef'}, active);
  const one = {reservationId:'run:100:attempt:1', pullNumber:10, headSha:'a'.repeat(40), now};
  grant = policy.reserveQuota(grant, one);
  assert.deepEqual(policy.reserveQuota(grant, one), grant, 'retry is idempotent');
  assert.throws(() => policy.reserveQuota(grant, {...one, pullNumber:11}), /different scope/);
  assert.throws(() => policy.reserveQuota(grant, {...one, reservationId:'run:100:attempt:2'}), /already has an active reservation/);
  grant = policy.reserveQuota(grant, {reservationId:'run:101:attempt:1', pullNumber:11, headSha:'b'.repeat(40), now});
  assert.throws(() => policy.reserveQuota(grant, {reservationId:'run:102:attempt:1', pullNumber:12, headSha:'c'.repeat(40), now}), /fully reserved/);
  grant = policy.settleReservation(grant, 'run:100:attempt:1', 'released', now + 1);
  grant = policy.reserveQuota(grant, {reservationId:'run:102:attempt:1', pullNumber:12, headSha:'c'.repeat(40), now:now + 2});
  grant = policy.settleReservation(grant, 'run:102:attempt:1', 'consumed', now + 3);
  assert.throws(() => policy.settleReservation(grant, 'run:102:attempt:1', 'released', now + 4), /cannot change outcome/);
  assert.throws(() => policy.reserveQuota({...grant, reservations:null}, one), /malformed/);
  assert.throws(() => policy.reserveQuota(grant, {...one, reservationId:'run:zero:attempt:1', pullNumber:0}), /Invalid reservation scope/);
  const corrupt = {...grant, successfulMergeLimit:1, reservations:[
    {reservationId:'run:200:attempt:1',pullNumber:20,headSha:'d'.repeat(40),status:'consumed',reservedAt:new Date(now).toISOString(),completedAt:new Date(now + 1).toISOString()},
    {reservationId:'run:201:attempt:1',pullNumber:21,headSha:'e'.repeat(40),status:'pending',reservedAt:new Date(now).toISOString(),completedAt:null}
  ]};
  assert.equal(policy.validateGrant({grant:corrupt, repository:active.repository, ownerLogin:'moojjoo', grantId:corrupt.grantId, now:now + 2}).valid, false);
  assert.throws(() => policy.settleReservation(corrupt, 'run:201:attempt:1', 'consumed', now + 3), /quota state/);
});
