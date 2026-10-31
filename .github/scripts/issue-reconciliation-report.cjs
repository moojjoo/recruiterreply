'use strict';
const fs = require('node:fs');
const path = require('node:path');
const FINAL_MARKER = /(?:^|\n)Dev-Completes:\s*#(\d+)\b/gim;
const PARTIAL_MARKER = /(?:^|\n)Refs:?\s*#(\d+)\b/gim;
const CORE_CHECKS = ['verify', 'test', 'CodeQL required gate'];
const PROJECT_TITLES = ['recruiterreply project', "@moojjoo's recruiterreply project"];

function linkedIssueReferences(body = '') {
  const references = new Map();
  for (const match of body.matchAll(PARTIAL_MARKER)) references.set(Number(match[1]), 'partial');
  for (const match of body.matchAll(FINAL_MARKER)) references.set(Number(match[1]), 'final');
  return [...references].map(([number, kind]) => ({number, kind}));
}
function acceptanceChecklistComplete(body = '') {
  const section = body.match(/^## Acceptance criteria[^\n]*\n([\s\S]*)$/im);
  const criteria = section?.[1].split(/^## /m, 1)[0] || '';
  return /^\s*[-*]\s*\[[xX]\]/m.test(criteria) && !/^\s*[-*]\s*\[ \]/m.test(criteria);
}
function requiredCheckNames(files = []) {
  return files.some(file => file.filename?.startsWith('frontend/')) ? [...CORE_CHECKS, 'seo'] : [...CORE_CHECKS];
}
function blockers({pr, issue, referenceKind = 'final', checks = [], requiredChecks = CORE_CHECKS,
  deployment, projectState = 'member', tokenConfigured = true}) {
  const reasons = [];
  if (referenceKind !== 'final') reasons.push('Missing final Dev-Completes marker');
  if (!tokenConfigured) reasons.push('PROJECTS_WRITE_TOKEN not configured');
  if (projectState === 'unavailable') reasons.push('Project membership unavailable (token or API access)');
  if (projectState === 'missing') reasons.push('Issue missing from RecruiterReply Project');
  if (!deployment || deployment.conclusion !== 'success' || deployment.sha !== pr.merge_commit_sha || !deployment.smokePassed) reasons.push('Missing verified Dev deployment and smoke result for merge SHA');
  for (const name of requiredChecks) {
    if (!checks.some(check => check.name === name && check.head_sha === pr.head.sha && check.conclusion === 'success')) reasons.push(`Missing passing current-head check: ${name}`);
  }
  if (!(issue.labels || []).some(label => label.name === 'dev-acceptance-verified')) reasons.push('Missing controlled dev-acceptance-verified approval label');
  if (!acceptanceChecklistComplete(pr.body || '')) reasons.push('Acceptance checklist missing or incomplete');
  return reasons;
}
function markdownEscape(value) { return String(value).replace(/[|\r\n]/g, match => match === '|' ? '\\|' : ' '); }
async function projectStateForIssue({github, issue, core}) {
  if (!issue.node_id) return 'unavailable';
  try {
    const data = await github.graphql('query($id:ID!){node(id:$id){... on Issue{projectItems(first:100){nodes{project{title}}}}}}', {id: issue.node_id});
    return data.node?.projectItems?.nodes?.some(item => PROJECT_TITLES.includes((item.project?.title || '').toLowerCase())) ? 'member' : 'missing';
  } catch (error) {
    core.warning(`Project membership unavailable for #${issue.number}: ${error.message}`);
    return 'unavailable';
  }
}
async function report({github, context, core, outputDirectory = 'reconciliation-report', tokenConfigured = !!process.env.PROJECTS_WRITE_TOKEN}) {
  const {owner, repo} = context.repo;
  const prs = await github.paginate(github.rest.pulls.list, {owner, repo, state: 'closed', per_page: 100});
  const merged = prs.filter(pr => pr.merged_at && pr.base.ref === 'main');
  const issueCache = new Map();
  const rows = [];
  for (const pr of merged) {
    for (const reference of linkedIssueReferences(pr.body || '')) {
      let issue = issueCache.get(reference.number);
      if (!issue) {
        ({data: issue} = await github.rest.issues.get({owner, repo, issue_number: reference.number}));
        issueCache.set(reference.number, issue);
      }
      if (issue.state !== 'open' || issue.pull_request) continue;
      const files = await github.paginate(github.rest.pulls.listFiles, {owner, repo, pull_number: pr.number, per_page: 100});
      const checks = await github.paginate(github.rest.checks.listForRef, {owner, repo, ref: pr.head.sha, per_page: 100});
      const runs = await github.paginate(github.rest.actions.listWorkflowRunsForRepo, {owner, repo, head_sha: pr.merge_commit_sha, per_page: 100});
      const run = runs.find(candidate => candidate.name === 'Build and Deploy to Dev' && candidate.head_sha === pr.merge_commit_sha && candidate.conclusion === 'success');
      let smokePassed = false;
      if (run) {
        const jobs = await github.paginate(github.rest.actions.listJobsForWorkflowRun, {owner, repo, run_id: run.id, per_page: 100});
        smokePassed = jobs.some(job => job.conclusion === 'success' && (job.steps || []).some(step => /smoke|verify live dev/i.test(step.name) && step.conclusion === 'success'));
      }
      const deployment = run ? {sha: run.head_sha, conclusion: run.conclusion, smokePassed, runUrl: run.html_url} : null;
      const projectState = await projectStateForIssue({github, issue: {...issue, number: reference.number}, core});
      const requiredChecks = requiredCheckNames(files);
      const reasons = blockers({pr, issue, referenceKind: reference.kind, checks, requiredChecks, deployment, projectState, tokenConfigured});
      rows.push({issue: reference.number, pr: pr.number, linkKind: reference.kind, headSha: pr.head.sha, mergeSha: pr.merge_commit_sha,
        deploymentRunUrl: deployment?.runUrl || null, requiredChecks, blockers: reasons});
    }
  }
  rows.sort((a, b) => a.issue - b.issue || a.pr - b.pr);
  const document = {schemaVersion: 1, generatedAt: new Date().toISOString(), repository: `${owner}/${repo}`, candidates: rows};
  const lines = rows.length ? rows.map(row => `| #${row.issue} | #${row.pr} | ${row.linkKind} | ${markdownEscape(row.mergeSha.slice(0, 12))} | ${markdownEscape(row.blockers.join('; ') || 'Ready')} |`) : ['| - | - | - | - | No open linked issues found |'];
  const summary = ['# Dev issue reconciliation audit', '', '| Issue | PR | Link | Merge SHA | Status |', '|---|---|---|---|---|', ...lines, ''].join('\n');
  fs.mkdirSync(outputDirectory, {recursive: true});
  fs.writeFileSync(path.join(outputDirectory, 'report.json'), `${JSON.stringify(document, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDirectory, 'summary.md'), summary);
  await core.summary.addRaw(summary).write();
  core.notice(`Unresolved completion candidates: ${rows.length}`);
  return rows;
}
module.exports = {FINAL_MARKER, PARTIAL_MARKER, linkedIssueReferences, acceptanceChecklistComplete, requiredCheckNames, blockers, projectStateForIssue, report};
