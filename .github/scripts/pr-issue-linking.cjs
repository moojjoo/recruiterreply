'use strict';

const ISSUE_MARKER = /(?:^|\n)(?:Refs|Dev-Completes):?\s+#(\d+)\b/gim;

function issueNumberFromPullRequest(pr) {
  const branch = pr.head?.ref || '';
  const branchMatch = branch.match(/^(?:feature|fix|bugfix|execute)\/(\d+)(?:-|$)/i);
  if (branchMatch) return Number(branchMatch[1]);

  const commandMatch = String(pr.body || '').match(/(?:^|\s)\/execute\s+(\d+)\b/i);
  return commandMatch ? Number(commandMatch[1]) : null;
}

function linkedIssueNumbers(body = '') {
  return [...new Set([...String(body).matchAll(ISSUE_MARKER)].map(match => Number(match[1])))];
}

function acceptanceChecklistComplete(body = '') {
  const section = String(body).match(/^## Acceptance criteria[^\n]*\n([\s\S]*?)(?=^## |$)/im);
  const criteria = section?.[1] || '';
  return /^\s*[-*]\s*\[[xX]\]/m.test(criteria) && !/^\s*[-*]\s*\[ \]/m.test(criteria);
}

function ensureIssueLink(body, issueNumber) {
  const text = String(body || '').trimEnd();
  const linked = linkedIssueNumbers(text);
  if (linked.includes(issueNumber)) return text;

  const relation = acceptanceChecklistComplete(text) ? `Dev-Completes: #${issueNumber}` : `Refs #${issueNumber}`;
  return `${text}\n\n## Issue linking\n${relation}\n`;
}

module.exports = {issueNumberFromPullRequest, linkedIssueNumbers, acceptanceChecklistComplete, ensureIssueLink};
