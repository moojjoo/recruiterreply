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
function validateReadiness({pr, checks = [], reviews = [], threads = [], dependenciesMerged = true, changedFiles = []}) {
  const reasons = [];
  if (pr.draft) reasons.push('PR is draft');
  const risk = classifyRisk(changedFiles);
  if (risk === 'high') reasons.push('High/unknown risk change requires manual merge review');
  if (!(pr.labels || []).some(x => (typeof x === 'string' ? x : x.name) === 'automation-ready')) reasons.push('Missing automation-ready label');
  const body = pr.body || '';
  const evidence = body.match(/^## Implementation evidence\s*\n([\s\S]*?)(?=^## |$(?![\s\S]))/mi);
  if (!evidence || !/\b(commit|test|verification|workflow)\b/i.test(evidence[1]) || evidence[1].trim().length < 20) reasons.push('Missing substantive implementation evidence');
  const criteria = body.match(/^## Acceptance criteria\s*\n([\s\S]*?)(?=^## |$(?![\s\S]))/mi);
  const lines = criteria ? criteria[1].split(/\r?\n/).filter(x => /^\s*[-*]\s*\[[ xX]\]/.test(x)) : [];
  if (!lines.length) reasons.push('No acceptance criteria checklist');
  if (lines.some(x => !/^\s*[-*]\s*\[[xX]\]/.test(x))) reasons.push('Unchecked acceptance criteria');
  if (!dependenciesMerged) reasons.push('Unmerged PR dependency');
  const required = ['verify', 'test', 'analyze (javascript-typescript)', 'analyze (csharp)'];
  for (const name of required) {
    if (!checks.some(c => c.name === name && c.head_sha === pr.head.sha && c.status === 'completed' && c.conclusion === 'success')) reasons.push('Missing successful current-SHA check: ' + name);
  }
  // Only the latest submitted review by each reviewer counts.
  const latest = new Map();
  for (const r of reviews) if (r.user?.login && r.state !== 'COMMENTED' && r.state !== 'DISMISSED') latest.set(r.user.login, r.state);
  if ([...latest.values()].includes('CHANGES_REQUESTED')) reasons.push('Changes requested');
  if (threads.some(t => !t.isResolved && !t.isOutdated)) reasons.push('Unresolved review thread');
  return {eligible: reasons.length === 0, risk, reasons};
}
module.exports = {validateReadiness,classifyRisk};
