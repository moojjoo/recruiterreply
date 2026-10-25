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

function validateReadiness({pr, checks = [], reviews = [], threads = [], dependenciesMerged = true, changedFiles = [], trustedDependabotUpdate = false}) {
  const reasons = [];
  if (pr.draft) reasons.push('PR is draft');
  const risk = classifyRisk(changedFiles);
  if (risk === 'high' && !trustedDependabotUpdate) reasons.push('High/unknown risk change requires manual merge review');
  if (!trustedDependabotUpdate && !(pr.labels || []).some(x => (typeof x === 'string' ? x : x.name) === 'automation-ready')) reasons.push('Missing automation-ready label');
  const body = pr.body || '';
  const evidence = body.match(/^## Implementation evidence\s*\n([\s\S]*?)(?=^## |$(?![\s\S]))/mi);
  if (!trustedDependabotUpdate && (!evidence || !/\b(commit|test|verification|workflow)\b/i.test(evidence[1]) || evidence[1].trim().length < 20)) reasons.push('Missing substantive implementation evidence');
  const criteria = body.match(/^## Acceptance criteria\s*\n([\s\S]*?)(?=^## |$(?![\s\S]))/mi);
  const lines = criteria ? criteria[1].split(/\r?\n/).filter(x => /^\s*[-*]\s*\[[ xX]\]/.test(x)) : [];
  if (!trustedDependabotUpdate && !lines.length) reasons.push('No acceptance criteria checklist');
  if (!trustedDependabotUpdate && lines.some(x => !/^\s*[-*]\s*\[[xX]\]/.test(x))) reasons.push('Unchecked acceptance criteria');
  if (!dependenciesMerged) reasons.push('Unmerged PR dependency');
  const required = ['verify', 'test', 'codeql required gate', ...requiredCodeQLChecks(changedFiles)];
  for (const name of required) {
    if (!checks.some(c => typeof c.name === 'string' && c.name.toLowerCase() === name && c.head_sha === pr.head.sha && c.status === 'completed' && c.conclusion === 'success')) reasons.push('Missing successful current-SHA check: ' + name);
  }
  // Only the latest submitted review by each reviewer counts.
  const latest = new Map();
  for (const r of reviews) if (r.user?.login && r.state !== 'COMMENTED' && r.state !== 'DISMISSED') latest.set(r.user.login, r.state);
  if ([...latest.values()].includes('CHANGES_REQUESTED')) reasons.push('Changes requested');
  if (threads.some(t => !t.isResolved && !t.isOutdated)) reasons.push('Unresolved review thread');
  return {eligible: reasons.length === 0, risk, reasons};
}
module.exports = {validateReadiness,classifyRisk,classifyDependabotUpdate,requiredCodeQLChecks};
