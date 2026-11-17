'use strict';

const crypto = require('node:crypto');

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const GRANT_ID_PATTERN = /^gd_[0-9a-f]{16}$/;
const SENSITIVE_PATH = /(^|\/)(\.github|\.agents|infra|infrastructure|terraform|migrations|secrets|iam|auth|identity|security|payments?|billing|stripe|webhooks?|deploy|release|scripts)(\/|$)|(^|\/)(Dockerfile|docker-compose[^/]*|package(?:-lock)?\.json|.*\.tf(?:vars)?|.*\.ya?ml|.*\.csproj|.*\.sln|.*\.props|.*\.targets|.*\.env[^/]*)$/i;
const SENSITIVE_BASENAME = /(auth|cognito|oauth|oidc|jwt|token|password|csrf|cookie|credential|permission|session|identity|security|payments?|billing|stripe|webhooks?|deploy|release|secrets?|iam|infra(?:structure)?|migrations?)/i;
const HARD_MAX_CHANGED_FILES = 40;
const HARD_MAX_CHANGED_LINES = 1200;

function validateConfiguration(config) {
  const reasons = [];
  if (!config || config.schemaVersion !== 1) reasons.push('Unsupported or missing policy schema');
  if (config?.enabled !== true) reasons.push('Dev delegation is disabled');
  if (!/^[-A-Za-z0-9_.]+\/[-A-Za-z0-9_.]+$/.test(config?.repository || '')) reasons.push('Repository is not pinned');
  if (!Number.isSafeInteger(config?.controlIssueNumber) || config.controlIssueNumber < 1) reasons.push('Control issue is not pinned');
  for (const name of ['appId', 'installationId', 'botUserId', 'botLogin']) {
    const value = config?.githubApp?.[name];
    if (name === 'botLogin') {
      if (typeof value !== 'string' || !/^[A-Za-z0-9-]+\[bot\]$/.test(value)) reasons.push('Bot login is not pinned');
    } else if (!Number.isSafeInteger(value) || value < 1) reasons.push(`${name} is not pinned`);
  }
  const limits = config?.limits || {};
  if (!Number.isSafeInteger(limits.maxGrantHours) || limits.maxGrantHours < 1 || limits.maxGrantHours > 8) reasons.push('Grant-hour limit exceeds policy');
  if (!Number.isSafeInteger(limits.maxSuccessfulMerges) || limits.maxSuccessfulMerges < 1 || limits.maxSuccessfulMerges > 5) reasons.push('Merge limit exceeds policy');
  if (!Number.isSafeInteger(limits.maxChangedFiles) || limits.maxChangedFiles < 1 || limits.maxChangedFiles > HARD_MAX_CHANGED_FILES) reasons.push('Changed-file limit exceeds policy');
  if (!Number.isSafeInteger(limits.maxChangedLines) || limits.maxChangedLines < 1 || limits.maxChangedLines > HARD_MAX_CHANGED_LINES) reasons.push('Changed-line limit exceeds policy');
  return {valid: reasons.length === 0, reasons};
}

function parseOwnerGrantCommand(body) {
  if (typeof body !== 'string') return null;
  const match = /^\/grant-guru-dev\s+(\d+)h\s+(\d+)\s*$/.exec(body);
  if (!match) return null;
  return {hours: Number(match[1]), successfulMerges: Number(match[2])};
}

function parseOwnerRevokeCommand(body) {
  if (typeof body !== 'string') return null;
  const match = /^\/revoke-guru-dev\s+(gd_[0-9a-f]{16})\s*$/.exec(body);
  return match?.[1] || null;
}

function parseDelegatedCommand(body) {
  if (typeof body !== 'string') return null;
  const match = /^\/guru-execute-dev\s+(\d+)\s+([0-9a-f]{40})\s+(gd_[0-9a-f]{16})\s*$/.exec(body);
  if (!match) return null;
  return {issueNumber: Number(match[1]), headSha: match[2], grantId: match[3]};
}

function createGrant({repository, ownerLogin, hours, successfulMerges, issuedAt = Date.now(), nonce = crypto.randomBytes(8).toString('hex')}, config) {
  const configured = validateConfiguration(config);
  if (!configured.valid) throw new Error(configured.reasons.join('; '));
  if (!Number.isInteger(hours) || hours < 1 || hours > config.limits.maxGrantHours) throw new Error('Grant duration exceeds policy');
  if (!Number.isInteger(successfulMerges) || successfulMerges < 1 || successfulMerges > config.limits.maxSuccessfulMerges) throw new Error('Grant merge quota exceeds policy');
  if (!/^[0-9a-f]{16}$/.test(nonce)) throw new Error('Invalid grant nonce');
  const start = new Date(issuedAt);
  if (!Number.isFinite(start.valueOf())) throw new Error('Invalid grant timestamp');
  return {
    schemaVersion: 1, grantId: `gd_${nonce}`, repository, ownerLogin,
    issuedAt: start.toISOString(), expiresAt: new Date(start.valueOf() + hours * 3600000).toISOString(),
    successfulMergeLimit: successfulMerges, revokedAt: null, reservations: []
  };
}

function verifyAppIdentity({actor, comment, installation, repository}, config) {
  const reasons = [];
  const configured = validateConfiguration(config);
  if (!configured.valid) reasons.push(...configured.reasons);
  if (repository !== config?.repository) reasons.push('Repository does not match pinned repository');
  if (actor?.type !== 'Bot') reasons.push('Actor type is not Bot');
  if (actor?.id !== config?.githubApp?.botUserId) reasons.push('Bot numeric user ID does not match');
  if (actor?.login !== config?.githubApp?.botLogin) reasons.push('Bot login does not match');
  if (comment?.performed_via_github_app?.id !== config?.githubApp?.appId) reasons.push('Comment App ID is missing or does not match');
  if (installation?.id !== config?.githubApp?.installationId) reasons.push('Installation ID is missing or does not match');
  return {valid: reasons.length === 0, reasons};
}

function classifyDelegatedChange(files, limits) {
  const reasons = [];
  if (!Number.isSafeInteger(limits?.maxChangedFiles) || limits.maxChangedFiles < 1 || limits.maxChangedFiles > HARD_MAX_CHANGED_FILES ||
      !Number.isSafeInteger(limits?.maxChangedLines) || limits.maxChangedLines < 1 || limits.maxChangedLines > HARD_MAX_CHANGED_LINES) {
    return {eligible:false, reasons:['Changed-scope limits are invalid'], changedLines:0};
  }
  if (!Array.isArray(files) || files.length === 0) reasons.push('Changed file list is missing');
  if (files.length > limits.maxChangedFiles) reasons.push('Changed file count exceeds policy');
  let changedLines = 0;
  for (const file of files || []) {
    const name = file?.filename;
    const additions = file?.additions;
    const deletions = file?.deletions;
    if (!Number.isSafeInteger(additions) || additions < 0 || !Number.isSafeInteger(deletions) || deletions < 0) reasons.push(`${name || 'Unknown path'} has invalid line counts`);
    else changedLines += additions + deletions;
    if (typeof name !== 'string' || !name || name.startsWith('/') || name.includes('..') || name.includes('\\')) reasons.push('Changed path is invalid');
    if (!['added', 'modified'].includes(file?.status)) reasons.push(`${name || 'Unknown path'} uses a denied or unknown change type`);
    if (file?.patch === undefined || file?.patch === null) reasons.push(`${name || 'Unknown path'} is binary or has no reviewable patch`);
    const basename = typeof name === 'string' ? name.split('/').pop() : '';
    if (SENSITIVE_PATH.test(name || '') || SENSITIVE_BASENAME.test(basename || '')) reasons.push(`${name} is in delegated-deny scope`);
  }
  if (changedLines > limits.maxChangedLines) reasons.push('Changed line count exceeds policy');
  return {eligible: reasons.length === 0, reasons, changedLines};
}

function reservationStateReasons(reservations) {
  if (!Array.isArray(reservations)) return ['Grant reservations are missing or malformed'];
  const reasons = [];
  const ids = new Set();
  const activeScopes = new Set();
  for (const item of reservations) {
    if (!item || !/^[A-Za-z0-9_.:-]{8,100}$/.test(item.reservationId || '') || ids.has(item.reservationId)) reasons.push('Reservation ID is invalid or duplicated');
    else ids.add(item.reservationId);
    if (!Number.isSafeInteger(item?.pullNumber) || item.pullNumber < 1 || !SHA_PATTERN.test(item?.headSha || '')) reasons.push('Reservation scope is invalid');
    if (!['pending', 'consumed', 'released'].includes(item?.status)) reasons.push('Reservation status is invalid');
    const scope = `${item?.pullNumber}:${item?.headSha}`;
    if (['pending', 'consumed'].includes(item?.status) && activeScopes.has(scope)) reasons.push('Active reservation scope is duplicated');
    else if (['pending', 'consumed'].includes(item?.status)) activeScopes.add(scope);
    if (!Number.isFinite(Date.parse(item?.reservedAt))) reasons.push('Reservation timestamp is invalid');
    if (item?.status === 'pending' ? item?.completedAt !== null : !Number.isFinite(Date.parse(item?.completedAt))) reasons.push('Reservation completion timestamp is invalid');
  }
  return reasons;
}

function validateGrant({grant, repository, ownerLogin, grantId, now = Date.now()}) {
  const reasons = [];
  if (!grant || grant.schemaVersion !== 1 || !GRANT_ID_PATTERN.test(grant.grantId || '')) reasons.push('Grant record is malformed');
  if (grant?.grantId !== grantId) reasons.push('Grant ID does not match');
  if (grant?.repository !== repository) reasons.push('Grant repository does not match');
  if (grant?.ownerLogin !== ownerLogin) reasons.push('Grant issuer is not the repository owner');
  const issued = Date.parse(grant?.issuedAt);
  const expires = Date.parse(grant?.expiresAt);
  if (!Number.isFinite(issued) || !Number.isFinite(expires) || expires <= issued || expires - issued > 8 * 3600000) reasons.push('Grant time bounds are invalid');
  if (now < issued - 300000 || now >= expires) reasons.push('Grant is not currently active');
  if (grant?.revokedAt) reasons.push('Grant is revoked');
  if (!Number.isInteger(grant?.successfulMergeLimit) || grant.successfulMergeLimit < 1 || grant.successfulMergeLimit > 5) reasons.push('Grant merge limit is invalid');
  reasons.push(...reservationStateReasons(grant?.reservations));
  if (Array.isArray(grant?.reservations) && grant.reservations.filter(item => ['consumed', 'pending'].includes(item?.status)).length > grant?.successfulMergeLimit) reasons.push('Active quota exceeds the grant limit');
  return {valid: reasons.length === 0, reasons};
}

function reserveQuota(grant, {reservationId, pullNumber, headSha, now = Date.now()}) {
  if (!/^[A-Za-z0-9_.:-]{8,100}$/.test(reservationId || '') || !SHA_PATTERN.test(headSha || '') || !Number.isSafeInteger(pullNumber) || pullNumber < 1) throw new Error('Invalid reservation scope');
  if (!Number.isInteger(grant?.successfulMergeLimit) || grant.successfulMergeLimit < 1 || grant.successfulMergeLimit > 5) throw new Error('Grant merge limit is invalid');
  const stateReasons = reservationStateReasons(grant?.reservations);
  if (stateReasons.length) throw new Error(stateReasons.join('; '));
  const reservations = grant.reservations.map(item => ({...item}));
  const existing = reservations.find(item => item.reservationId === reservationId);
  if (existing) {
    if (existing.pullNumber !== pullNumber || existing.headSha !== headSha) throw new Error('Reservation ID was reused for a different scope');
    return {...grant, reservations};
  }
  if (reservations.some(item => item.pullNumber === pullNumber && item.headSha === headSha && item.status !== 'released')) throw new Error('Pull request SHA already has an active reservation');
  const consumed = reservations.filter(item => item.status === 'consumed').length;
  const pending = reservations.filter(item => item.status === 'pending').length;
  if (consumed + pending >= grant.successfulMergeLimit) throw new Error('Grant quota is exhausted or fully reserved');
  reservations.push({reservationId, pullNumber, headSha, status:'pending', reservedAt:new Date(now).toISOString(), completedAt:null});
  return {...grant, reservations};
}

function settleReservation(grant, reservationId, outcome, now = Date.now()) {
  if (!['consumed', 'released'].includes(outcome)) throw new Error('Invalid reservation outcome');
  const stateReasons = reservationStateReasons(grant?.reservations);
  if (stateReasons.length) throw new Error(stateReasons.join('; '));
  if (!Number.isInteger(grant?.successfulMergeLimit) || grant.successfulMergeLimit < 1 || grant.successfulMergeLimit > 5 ||
      grant.reservations.filter(item => ['consumed', 'pending'].includes(item.status)).length > grant.successfulMergeLimit) throw new Error('Grant quota state is invalid');
  let found = false;
  const reservations = (grant.reservations || []).map(item => {
    if (item.reservationId !== reservationId) return {...item};
    found = true;
    if (item.status === outcome) return {...item};
    if (item.status !== 'pending') throw new Error('Settled reservation cannot change outcome');
    return {...item, status:outcome, completedAt:new Date(now).toISOString()};
  });
  if (!found) throw new Error('Reservation was not found');
  return {...grant, reservations};
}

module.exports = {
  validateConfiguration, parseOwnerGrantCommand, parseOwnerRevokeCommand, parseDelegatedCommand,
  createGrant, verifyAppIdentity, classifyDelegatedChange, validateGrant, reserveQuota, settleReservation
};
