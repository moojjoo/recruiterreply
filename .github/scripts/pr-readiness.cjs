'use strict';

// Pure policy. PR metadata is untrusted; no code from a PR is executed here.
function classifyRisk(files) {
  if (!Array.isArray(files) || !files.length) return 'high';
  let tier = 'low';
  for (const item of files) {
    const f = typeof item === 'string' ? item : item && item.filename;
    const previous = typeof item === 'object' && item ? item.previous_filename : undefined;
    const status = typeof item === 'object' && item ? item.status : undefined;
    if (typeof f !== 'string' || !f || f.includes('..') || f.startsWith('/') || f.includes('\\') ||
        (status && !['added','modified','removed','renamed','copied','changed'].includes(status))) return 'high';
    if (status === 'renamed' && (!previous || classifyRisk([previous]) === 'high')) return 'high';
    if (status === 'removed') return 'high';
    const sensitive = /(^|\/)(\.github|infra|infrastructure|terraform|migrations|secrets|iam|auth|security|payments?|billing|stripe|webhooks?|deploy|release|scripts)(\/|$)|(^|\/)(Dockerfile|docker-compose[^/]*|package(?:-lock)?\.json|.*\.tf(?:vars)?|.*\.ya?ml|.*\.csproj|.*\.sln|.*\.props|.*\.targets|.*\.env[^/]*)$/i;
    if (sensitive.test(f)) return 'high';
    if (/^(docs\/[a-zA-Z0-9_./-]+\.md|README\.md|frontend\/src\/[a-zA-Z0-9_./-]+\.(?:css|scss))$/.test(f)) continue;
    if (/^(frontend\/src\/[a-zA-Z0-9_./-]+\.(?:jsx?|tsx?)|frontend\/tests?\/[a-zA-Z0-9_./-]+\.(?:jsx?|tsx?)|backend\/[a-zA-Z0-9_./-]+\.(?:cs|csx))$/.test(f) &&
        !/(^|\/)(auth|security|payments?|billing|stripe|webhooks?|config|middleware|startup|program|identity|secrets)(\/|\.|$)/i.test(f)) {
      tier = 'medium';
      continue;
    }
    return 'high';
  }
  return tier;
}

const dependabotVersionPattern = /v?(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?/;
const dependabotEcosystems = new Map([
  ['npm_and_yarn', /^frontend\/(?:package(?:-lock)?\.json|npm-shrinkwrap\.json)$/],
  ['nuget', /^backend\/.*\.(?:csproj|props|targets|lock\.json)$/],
  ['github_actions', /^\.github\/workflows\/[^/]+\.ya?ml$/],
  ['terraform', /^infra\/aws\/terraform\/.*\.(?:tf|tfvars|lock\.hcl)$/],
]);

function parseDependabotVersions(text) {
  if (typeof text !== 'string') return null;
  const version = dependabotVersionPattern.source;
  const match = new RegExp(`\\bfrom\\s+${version}\\s+to\\s+${version}`, 'i').exec(text);
  if (!match) return null;
  const from = match.slice(1, 4).map(Number);
  const to = match.slice(4, 7).map(Number);
  return {from, to};
}

function classifyDependabotUpdate(pr, changedFiles = []) {
  const result = {eligible: false, reason: 'Unclassified Dependabot update'};
  if (!pr || pr.user?.login !== 'dependabot[bot]') {
    return {...result, reason: 'Untrusted PR author'};
  }
  if (pr.base?.ref !== 'main') return {...result, reason: 'Target branch is not main'};
  if (!pr.head?.repo?.full_name || pr.head.repo.full_name !== pr.base?.repo?.full_name) {
    return {...result, reason: 'PR source repository is not the target repository'};
  }
  if (pr.draft) return {...result, reason: 'Dependabot PR is draft'};

  const branchMatch = /^dependabot\/(nuget|npm_and_yarn|github_actions|terraform)\//.exec(pr.head.ref || '');
  if (!branchMatch) return {...result, reason: 'Unsupported Dependabot ecosystem or branch'};
  const ecosystem = branchMatch[1];
  const metadata = `${pr.title || ''}\n${pr.body || ''}`;
  if (!/\bBumps?\b/i.test(pr.body || '')) return {...result, ecosystem, reason: 'Missing Dependabot update metadata'};
  const versions = parseDependabotVersions(metadata);
  if (!versions) return {...result, ecosystem, reason: 'Missing semver update metadata'};

  const [fromMajor, fromMinor, fromPatch] = versions.from;
  const [toMajor, toMinor, toPatch] = versions.to;
  let updateType;
  if (toMajor !== fromMajor) updateType = 'major';
  else if (toMinor !== fromMinor) updateType = 'minor';
  else if (toPatch !== fromPatch) updateType = 'patch';
  else return {...result, ecosystem, reason: 'Version metadata does not describe an update'};
  if (toMajor < fromMajor || (toMajor === fromMajor && toMinor < fromMinor) ||
      (toMajor === fromMajor && toMinor === fromMinor && toPatch < fromPatch)) {
    return {...result, ecosystem, updateType, reason: 'Version update moves backwards'};
  }
  if (updateType === 'major') return {...result, ecosystem, updateType, reason: 'Major update requires manual review'};

  const pathPattern = dependabotEcosystems.get(ecosystem);
  const files = Array.isArray(changedFiles) ? changedFiles : [];
  if (!files.length || files.some(file => {
    const filename = typeof file === 'string' ? file : file?.filename;
    const status = typeof file === 'object' && file ? file.status : undefined;
    return !filename || !pathPattern.test(filename) || (status && !['added', 'modified'].includes(status));
  })) {
    return {...result, ecosystem, updateType, reason: 'Changed files exceed the ecosystem dependency allowlist'};
  }
  return {eligible: true, ecosystem, updateType, reason: 'Trusted patch/minor Dependabot update'};
}

function requiredCodeQLChecks(changedFiles = []) {
  const files = Array.isArray(changedFiles) ? changedFiles : [];
  if (!files.length) return ['analyze (javascript-typescript)', 'analyze (csharp)'];

  let frontend = false;
  let backend = false;
  let shared = false;
  for (const item of files) {
    const filename = typeof item === 'string' ? item : item?.filename;
    const previous = typeof item === 'object' && item ? item.previous_filename : undefined;
    const names = [filename, previous].filter(Boolean);
    if (!names.length) return ['analyze (javascript-typescript)', 'analyze (csharp)'];
    for (const name of names) {
      if (/^frontend\//.test(name)) frontend = true;
      else if (/^backend\//.test(name)) backend = true;
      else shared = true;
    }
  }

  if (!shared && frontend && !backend) return ['analyze (javascript-typescript)'];
  if (!shared && backend && !frontend) return ['analyze (csharp)'];
  return ['analyze (javascript-typescript)', 'analyze (csharp)'];
}

const authorizationMarker = '<!-- recruiterreply:execute-dev-authorization -->';
const authorizationExpiryMs = 24 * 60 * 60 * 1000;

function requiredCheckState({checks = [], headSha, changedFiles = []}) {
  const required = ['verify', 'test', 'codeql required gate', ...requiredCodeQLChecks(changedFiles)];
  const pending = [];
  const failed = [];
  const missing = [];
  for (const name of required) {
    const matches = checks.filter(c => typeof c.name === 'string' && c.name.toLowerCase() === name && c.head_sha === headSha);
    if (!matches.length) missing.push(name);
    else if (matches.some(c => c.status !== 'completed')) pending.push(name);
    else if (!matches.some(c => c.conclusion === 'success')) failed.push(name);
  }
  return {ready: !pending.length && !failed.length && !missing.length, required, pending, failed, missing};
}

function parseOwnerCommand(body, issueNumber) {
  if (typeof body !== 'string') return null;
  const match = /^\s*\/(execute-dev|revoke-execute-dev)\s+(\d+)\s*$/i.exec(body);
  if (!match || Number(match[2]) !== Number(issueNumber)) return null;
  return match[1].toLowerCase();
}

function createAuthorizationRecord({repository, issueNumber, pullNumber, headSha, actor, issuedAt}) {
  return {
    repository, issueNumber: Number(issueNumber), pullNumber: Number(pullNumber), headSha,
    actor, issuedAt: new Date(issuedAt).toISOString()
  };
}

function formatAuthorizationComment(record) {
  const encoded = Buffer.from(JSON.stringify(record), 'utf8').toString('base64url');
  return `${authorizationMarker}\nOwner execute-dev authorization recorded for commit \`${record.headSha}\`. A new push or owner revocation invalidates it.\n\`${encoded}\``;
}

function parseAuthorizationComment(body) {
  if (typeof body !== 'string' || !body.includes(authorizationMarker)) return null;
  const match = /\n`([A-Za-z0-9_-]+)`\s*$/.exec(body);
  if (!match) return null;
  try { return JSON.parse(Buffer.from(match[1], 'base64url').toString('utf8')); }
  catch { return null; }
}

function validateOwnerAuthorization({comments = [], repository, issueNumber, pullNumber, headSha, ownerLogin, now = Date.now()}) {
  const trusted = comments
    .filter(c => c.user?.login === 'github-actions[bot]')
    .map(c => ({comment:c, record:parseAuthorizationComment(c.body)}))
    .filter(x => x.record)
    .sort((a, b) => new Date(b.comment.created_at || b.record.issuedAt) - new Date(a.comment.created_at || a.record.issuedAt));
  const record = trusted[0]?.record;
  if (!record) return {authorized:false, reason:'Missing trusted owner execute-dev authorization'};
  if (record.repository !== repository || Number(record.issueNumber) !== Number(issueNumber) || Number(record.pullNumber) !== Number(pullNumber)) {
    return {authorized:false, reason:'Owner authorization scope does not match this pull request'};
  }
  if (record.actor !== ownerLogin) return {authorized:false, reason:'Owner authorization actor is not the repository owner'};
  if (record.headSha !== headSha) return {authorized:false, reason:'Owner authorization expired after the pull request head changed'};
  const issued = Date.parse(record.issuedAt);
  if (!Number.isFinite(issued) || now - issued > authorizationExpiryMs || issued > now + 5 * 60 * 1000) {
    return {authorized:false, reason:'Owner authorization is expired or has an invalid timestamp'};
  }
  const revoked = comments.some(c => c.user?.login === ownerLogin && parseOwnerCommand(c.body, issueNumber) === 'revoke-execute-dev' && Date.parse(c.created_at) >= issued);
  if (revoked) return {authorized:false, reason:'Owner authorization was revoked'};
  return {authorized:true, record};
}

function validateReadiness({pr, checks = [], reviews = [], threads = [], dependenciesMerged = true, changedFiles = [], trustedDependabotUpdate = false, ownerAuthorization = false}) {
  const reasons = [];
  if (pr.draft) reasons.push('PR is draft');
  const risk = classifyRisk(changedFiles);
  if (risk === 'high' && !trustedDependabotUpdate && !ownerAuthorization) reasons.push('High/unknown risk change requires owner execute-dev authorization for the current SHA');
  if (!trustedDependabotUpdate && !(pr.labels || []).some(x => (typeof x === 'string' ? x : x.name) === 'automation-ready')) reasons.push('Missing automation-ready label');
  const body = pr.body || '';
  const evidence = body.match(/^## Implementation evidence\s*\n([\s\S]*?)(?=^## |$(?![\s\S]))/mi);
  if (!trustedDependabotUpdate && (!evidence || !/\b(commit|test|verification|workflow)\b/i.test(evidence[1]) || evidence[1].trim().length < 20)) reasons.push('Missing substantive implementation evidence');
  const criteria = body.match(/^## Acceptance criteria\s*\n([\s\S]*?)(?=^## |$(?![\s\S]))/mi);
  const lines = criteria ? criteria[1].split(/\r?\n/).filter(x => /^\s*[-*]\s*\[[ xX]\]/.test(x)) : [];
  if (!trustedDependabotUpdate && !lines.length) reasons.push('No acceptance criteria checklist');
  if (!trustedDependabotUpdate && lines.some(x => !/^\s*[-*]\s*\[[xX]\]/.test(x))) reasons.push('Unchecked acceptance criteria');
  if (!dependenciesMerged) reasons.push('Unmerged PR dependency');
  const checkState = requiredCheckState({checks, headSha:pr.head.sha, changedFiles});
  for (const name of checkState.pending) reasons.push('Pending current-SHA check: ' + name);
  for (const name of checkState.failed) reasons.push('Failed current-SHA check: ' + name);
  for (const name of checkState.missing) reasons.push('Missing current-SHA check: ' + name);
  // Only the latest submitted review by each reviewer counts.
  const latest = new Map();
  for (const r of reviews) if (r.user?.login && r.state !== 'COMMENTED' && r.state !== 'DISMISSED') latest.set(r.user.login, r.state);
  if ([...latest.values()].includes('CHANGES_REQUESTED')) reasons.push('Changes requested');
  if (threads.some(t => !t.isResolved && !t.isOutdated)) reasons.push('Unresolved review thread');
  return {eligible: reasons.length === 0, risk, reasons, checkState};
}
module.exports = {
  validateReadiness,classifyRisk,classifyDependabotUpdate,requiredCodeQLChecks,requiredCheckState,
  parseOwnerCommand,createAuthorizationRecord,formatAuthorizationComment,parseAuthorizationComment,
  validateOwnerAuthorization,authorizationMarker
};
