'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const {spawnSync} = require('node:child_process');

const REPOSITORY = 'recruiterreply-backend';
const FULL_SHA = /^[a-f0-9]{40}$/;
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const ENVIRONMENT_LIMITS = Object.freeze({dev: 10, test: 5, prod: 4});
const NEWEST_BUILD_LIMIT = 5;
const UNTAGGED_GRACE_DAYS = 7;
const APPLY_CONFIRMATION = 'DELETE-ECR-DEV10-TEST5-PROD4';

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key =>
      `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function validatePolicy(policy) {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy) ||
      Object.keys(policy).sort().join(',') !== Object.keys(ENVIRONMENT_LIMITS).sort().join(',')) {
    throw new Error('retention policy must contain exactly dev, test, and prod');
  }
  for (const [environment, limit] of Object.entries(ENVIRONMENT_LIMITS)) {
    const shas = policy[environment];
    if (!Array.isArray(shas) || shas.length === 0 || shas.length > limit ||
        new Set(shas).size !== shas.length || shas.some(sha => !FULL_SHA.test(sha))) {
      throw new Error(`invalid ${environment} deployment history`);
    }
  }
}

function normalizeImage(image) {
  if (!image || !DIGEST.test(image.imageDigest || '')) {
    throw new Error('ECR inventory contains an invalid image digest');
  }
  const pushed = new Date(image.imagePushedAt);
  if (!Number.isFinite(pushed.getTime())) {
    throw new Error(`ECR image ${image.imageDigest} has an invalid pushed timestamp`);
  }
  const tags = [...new Set(image.imageTags || [])].sort();
  if (tags.some(tag => typeof tag !== 'string' || tag.length === 0)) {
    throw new Error(`ECR image ${image.imageDigest} has an invalid tag`);
  }
  const size = Number(image.imageSizeInBytes || 0);
  if (!Number.isSafeInteger(size) || size < 0) {
    throw new Error(`ECR image ${image.imageDigest} has an invalid size`);
  }
  return {
    digest: image.imageDigest,
    tags,
    pushedAt: pushed.toISOString(),
    sizeBytes: size
  };
}

function buildPlan({repository = REPOSITORY, images, policy, now = new Date()}) {
  if (repository !== REPOSITORY) throw new Error(`repository must be ${REPOSITORY}`);
  validatePolicy(policy);
  const currentTime = new Date(now);
  if (!Number.isFinite(currentTime.getTime())) throw new Error('invalid planning time');

  const normalized = images.map(normalizeImage).sort((left, right) =>
    left.digest.localeCompare(right.digest));
  if (new Set(normalized.map(image => image.digest)).size !== normalized.length) {
    throw new Error('ECR inventory contains duplicate digests');
  }

  const bySha = new Map();
  for (const image of normalized) {
    for (const tag of image.tags.filter(tag => FULL_SHA.test(tag))) {
      if (bySha.has(tag)) throw new Error(`commit SHA ${tag} resolves to multiple ECR digests`);
      bySha.set(tag, image);
    }
  }

  const reasons = new Map(normalized.map(image => [image.digest, new Set()]));
  for (const [environment, shas] of Object.entries(policy)) {
    for (const sha of shas) {
      const image = bySha.get(sha);
      if (!image) throw new Error(`protected ${environment} deployment SHA is missing from ECR: ${sha}`);
      reasons.get(image.digest).add(`${environment}_deployment:${sha}`);
    }
  }

  const newestShaImages = normalized
    .filter(image => image.tags.some(tag => FULL_SHA.test(tag)))
    .sort((left, right) => right.pushedAt.localeCompare(left.pushedAt) ||
      left.digest.localeCompare(right.digest))
    .slice(0, NEWEST_BUILD_LIMIT);
  newestShaImages.forEach(image => reasons.get(image.digest).add('newest_build'));

  const graceMilliseconds = UNTAGGED_GRACE_DAYS * 24 * 60 * 60 * 1000;
  for (const image of normalized) {
    const imageReasons = reasons.get(image.digest);
    for (const tag of image.tags.filter(tag => !FULL_SHA.test(tag))) {
      imageReasons.add(`non_sha_tag:${tag}`);
    }
    if (image.tags.length === 0 &&
        currentTime.getTime() - new Date(image.pushedAt).getTime() < graceMilliseconds) {
      imageReasons.add('untagged_grace');
    }
  }

  const protectedImages = normalized
    .filter(image => reasons.get(image.digest).size > 0)
    .map(image => ({...image, reasons: [...reasons.get(image.digest)].sort()}));
  const candidates = normalized.filter(image => reasons.get(image.digest).size === 0);
  const digestPayload = {repository, policy, inventory: normalized, protectedImages, candidates};
  const planDigest = crypto.createHash('sha256').update(stableJson(digestPayload)).digest('hex');

  return {
    repository,
    policy,
    generatedAt: currentTime.toISOString(),
    planDigest,
    inventoryCount: normalized.length,
    protectedImages,
    candidates,
    protectedCount: protectedImages.length,
    candidateCount: candidates.length,
    candidateReportedBytes: candidates.reduce((total, image) => total + image.sizeBytes, 0)
  };
}

function defaultAws(args) {
  const result = spawnSync('aws', args, {encoding: 'utf8', maxBuffer: 20 * 1024 * 1024});
  if (result.status !== 0) {
    const message = (result.stderr || result.stdout || 'AWS CLI failed').trim();
    throw new Error(message);
  }
  return JSON.parse(result.stdout || '{}');
}

function listImages({region, repository = REPOSITORY, aws = defaultAws}) {
  if (repository !== REPOSITORY) throw new Error(`repository must be ${REPOSITORY}`);
  const images = [];
  let nextToken;
  do {
    const args = ['ecr', 'describe-images', '--region', region, '--repository-name', repository,
      '--max-results', '100', '--no-paginate', '--output', 'json'];
    if (nextToken) args.push('--next-token', nextToken);
    const page = aws(args);
    if (!Array.isArray(page.imageDetails)) throw new Error('ECR inventory response is incomplete');
    images.push(...page.imageDetails);
    nextToken = page.nextToken;
    if (nextToken !== undefined && typeof nextToken !== 'string') {
      throw new Error('ECR inventory returned an invalid pagination token');
    }
  } while (nextToken);
  return images;
}

function chunk(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) chunks.push(values.slice(index, index + size));
  return chunks;
}

function deletionIds(candidates) {
  return candidates.flatMap(image => image.tags.length > 0
    ? image.tags.map(imageTag => ({imageTag}))
    : [{imageDigest: image.digest}]);
}

function applyPlan({plan, expectedPlanDigest, confirmation, region, aws = defaultAws}) {
  if (!/^[a-f0-9]{64}$/.test(expectedPlanDigest || '') ||
      expectedPlanDigest !== plan.planDigest) {
    throw new Error('current ECR cleanup plan does not match the approved preview digest');
  }
  if (confirmation !== APPLY_CONFIRMATION) {
    throw new Error(`apply requires confirmation ${APPLY_CONFIRMATION}`);
  }
  const failures = [];
  let deleted = 0;
  for (const imageIds of chunk(deletionIds(plan.candidates), 100)) {
    const result = aws(['ecr', 'batch-delete-image', '--region', region,
      '--repository-name', REPOSITORY, '--image-ids', JSON.stringify(imageIds), '--output', 'json']);
    failures.push(...(result.failures || []));
    deleted += (result.imageIds || []).length;
  }
  if (failures.length > 0) {
    throw new Error(`ECR reported ${failures.length} image deletion failure(s)`);
  }
  return {deletedReferences: deleted};
}

function parseArguments(argv) {
  const values = {mode: 'preview', region: process.env.AWS_REGION || 'us-east-1'};
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    if (!['--mode', '--region', '--policy-file', '--expected-plan-digest', '--confirmation'].includes(name)) {
      throw new Error(`unknown argument: ${name}`);
    }
    values[name.slice(2).replaceAll('-', '_')] = argv[++index];
  }
  if (!['preview', 'apply'].includes(values.mode)) throw new Error('mode must be preview or apply');
  if (!values.policy_file) throw new Error('--policy-file is required');
  return values;
}

function printPlan(plan) {
  console.log(`ECR images: ${plan.inventoryCount}`);
  console.log(`Protected images: ${plan.protectedCount}`);
  console.log(`Cleanup candidates: ${plan.candidateCount}`);
  for (const image of plan.protectedImages) {
    console.log('PROTECTED', image.digest, image.tags.join(','), image.reasons.join(','));
  }
  for (const image of plan.candidates) {
    console.log('CANDIDATE', image.digest, image.tags.join(','), image.pushedAt, image.sizeBytes);
  }
}

function main(argv = process.argv.slice(2), dependencies = {}) {
  const options = parseArguments(argv);
  const policy = JSON.parse(fs.readFileSync(options.policy_file, 'utf8'));
  const aws = dependencies.aws || defaultAws;
  const beforeImages = listImages({region: options.region, aws});
  const plan = buildPlan({images: beforeImages, policy, now: dependencies.now || new Date()});
  printPlan(plan);

  let result = {deletedReferences: 0};
  if (options.mode === 'apply') {
    const preflightImages = listImages({region: options.region, aws});
    const preflightPlan = buildPlan({images: preflightImages, policy,
      now: dependencies.now || new Date()});
    result = applyPlan({plan: preflightPlan, expectedPlanDigest: options.expected_plan_digest,
      confirmation: options.confirmation, region: options.region, aws});
  }
  const afterImages = options.mode === 'apply'
    ? listImages({region: options.region, aws}) : beforeImages;
  const afterPlan = buildPlan({images: afterImages, policy, now: dependencies.now || new Date()});
  if (options.mode === 'apply' && afterPlan.candidateCount !== 0) {
    throw new Error(`ECR cleanup left ${afterPlan.candidateCount} candidate image(s)`);
  }
  console.log('SUMMARY', JSON.stringify({mode: options.mode, repository: REPOSITORY,
    plan_digest: plan.planDigest, before_images: beforeImages.length,
    after_images: afterImages.length, protected_images: plan.protectedCount,
    candidate_images: plan.candidateCount, candidate_reported_bytes: plan.candidateReportedBytes,
    before_reported_bytes: beforeImages.reduce((total, image) =>
      total + Number(image.imageSizeInBytes || 0), 0),
    after_reported_bytes: afterImages.reduce((total, image) =>
      total + Number(image.imageSizeInBytes || 0), 0),
    deleted_references: result.deletedReferences}));
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {APPLY_CONFIRMATION, REPOSITORY, applyPlan, buildPlan, deletionIds,
  listImages, main, normalizeImage, parseArguments, stableJson, validatePolicy};
