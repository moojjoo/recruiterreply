'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const retention = require('../ecr-image-retention.cjs');

const sha = character => character.repeat(40);
const digest = character => `sha256:${character.repeat(64)}`;
const policy = {dev: [sha('a')], test: [sha('b')], prod: [sha('c')]};

function image(character, tags, day = 1, size = 100) {
  return {imageDigest: digest(character), imageTags: tags,
    imagePushedAt: `2026-10-${String(day).padStart(2, '0')}T00:00:00Z`, imageSizeInBytes: size};
}

test('protects environment histories, shared SHAs, five newest builds, and non-SHA tags', () => {
  const sharedPolicy = {dev: [sha('a')], test: [sha('a')], prod: [sha('b')]};
  const images = [image('1', [sha('a')], 1), image('2', [sha('b')], 2),
    image('3', [sha('c')], 3), image('4', [sha('d')], 4), image('5', [sha('e')], 5),
    image('6', [sha('f')], 6), image('7', [sha('0')], 7), image('8', ['dev-latest'], 1)];
  const plan = retention.buildPlan({images, policy: sharedPolicy, now: '2026-10-20T00:00:00Z'});
  assert.equal(plan.protectedImages.filter(value => value.reasons.some(reason =>
    reason.startsWith('dev_deployment') || reason.startsWith('test_deployment'))).length, 1);
  assert.equal(plan.protectedCount, 8);
  assert.equal(plan.candidateCount, 0);
});

test('protects recent untagged images and selects old untagged and superseded SHA images', () => {
  const images = [image('1', [sha('a')], 1), image('2', [sha('b')], 2),
    image('3', [sha('c')], 3), image('4', [sha('d')], 4), image('5', [sha('e')], 5),
    image('6', [sha('f')], 6), image('7', [sha('0')], 7), image('8', [sha('1')], 8),
    image('9', [sha('2')], 9), image('a', [], 20), image('b', [], 1)];
  const plan = retention.buildPlan({images, policy, now: '2026-10-25T00:00:00Z'});
  assert.deepEqual(plan.candidates.map(value => value.digest), [digest('4'), digest('b')]);
  assert.equal(plan.protectedImages.find(value => value.digest === digest('a')).reasons[0],
    'untagged_grace');
});

test('fails closed when a protected deployment SHA is missing', () => {
  assert.throws(() => retention.buildPlan({images: [image('1', [sha('a')])], policy}),
    /protected test deployment SHA is missing/);
});

test('inventory changes produce a different deterministic plan digest', () => {
  const images = [image('1', [sha('a')]), image('2', [sha('b')]), image('3', [sha('c')])];
  const first = retention.buildPlan({images, policy, now: '2026-10-20T00:00:00Z'});
  const second = retention.buildPlan({images: [...images, image('4', [], 1)], policy,
    now: '2026-10-20T00:00:00Z'});
  assert.notEqual(first.planDigest, second.planDigest);
  assert.equal(first.planDigest,
    retention.buildPlan({images: [...images].reverse(), policy, now: '2026-10-20T00:00:00Z'}).planDigest);
});

test('paginates the complete ECR inventory', () => {
  const calls = [];
  const aws = args => {
    calls.push(args);
    return calls.length === 1
      ? {imageDetails: [image('1', [sha('a')])], nextToken: 'page-two'}
      : {imageDetails: [image('2', [sha('b')])]};
  };
  assert.equal(retention.listImages({region: 'us-east-1', aws}).length, 2);
  assert.deepEqual(calls[1].slice(-2), ['--next-token', 'page-two']);
});

test('apply requires the approved digest and exact confirmation', () => {
  const plan = {planDigest: 'a'.repeat(64), candidates: []};
  assert.throws(() => retention.applyPlan({plan, expectedPlanDigest: 'b'.repeat(64),
    confirmation: retention.APPLY_CONFIRMATION, region: 'us-east-1', aws() {}}), /approved preview/);
  assert.throws(() => retention.applyPlan({plan, expectedPlanDigest: plan.planDigest,
    confirmation: 'wrong', region: 'us-east-1', aws() {}}), /requires confirmation/);
});

test('deletes tagged candidates by tag, untagged candidates by digest, and reports AWS failures', () => {
  const candidates = [
    {digest: digest('1'), tags: [sha('d')], pushedAt: '2026-10-01T00:00:00Z', sizeBytes: 1},
    {digest: digest('2'), tags: [], pushedAt: '2026-10-01T00:00:00Z', sizeBytes: 1}
  ];
  assert.deepEqual(retention.deletionIds(candidates),
    [{imageTag: sha('d')}, {imageDigest: digest('2')}]);
  const plan = {planDigest: 'a'.repeat(64), candidates};
  assert.throws(() => retention.applyPlan({plan, expectedPlanDigest: plan.planDigest,
    confirmation: retention.APPLY_CONFIRMATION, region: 'us-east-1',
    aws: () => ({failures: [{failureCode: 'ImageNotFound'}]})}), /deletion failure/);
});

test('main fails closed when the preflight inventory changed after preview planning', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ecr-retention-test-'));
  const policyFile = path.join(directory, 'policy.json');
  fs.writeFileSync(policyFile, JSON.stringify(policy));
  const firstInventory = [image('1', [sha('a')]), image('2', [sha('b')]), image('3', [sha('c')])];
  const approved = retention.buildPlan({images: firstInventory, policy,
    now: '2026-10-20T00:00:00Z'}).planDigest;
  let inventoryCalls = 0;
  const aws = args => {
    if (args[1] !== 'describe-images') throw new Error('deletion must not start');
    inventoryCalls += 1;
    return {imageDetails: inventoryCalls === 1
      ? firstInventory : [...firstInventory, image('4', ['moved-tag'])]};
  };
  assert.throws(() => retention.main(['--mode', 'apply', '--region', 'us-east-1',
    '--policy-file', policyFile, '--expected-plan-digest', approved,
    '--confirmation', retention.APPLY_CONFIRMATION], {aws, now: new Date('2026-10-20T00:00:00Z')}),
  /approved preview digest/);
  fs.rmSync(directory, {recursive: true});
});

test('rejects unrelated repositories and malformed policies', () => {
  assert.throws(() => retention.buildPlan({repository: 'other', images: [], policy}),
    /repository must be recruiterreply-backend/);
  assert.throws(() => retention.validatePolicy({dev: [], test: [], prod: []}),
    /invalid dev deployment history/);
});
