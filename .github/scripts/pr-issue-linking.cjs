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
  const criteria = checklistSection(body, 'Acceptance criteria');
  return /^\s*[-*]\s*\[[xX]\]/m.test(criteria) && !/^\s*[-*]\s*\[ \]/m.test(criteria);
}

function checklistSection(body, heading) {
  const section = String(body).match(new RegExp(`^## ${heading}[^\\n]*\\n([\\s\\S]*)`, 'im'));
  return section?.[1].split(/^## /m, 1)[0] || '';
}

function postMergeValidationComplete(body = '') {
  const text = String(body);
  if (!/^## Post-merge validation[^\n]*\n/im.test(text)) return true;
  const section = checklistSection(text, 'Post-merge validation');
  const items = section.split(/\r?\n/).filter(line => /^\s*[-*]\s*\[[ xX]\]/.test(line));
  if (!items.length) return false;
  return /^\s*[-*]\s*\[[xX]\]/m.test(section) && !/^\s*[-*]\s*\[ \]/m.test(section);
}

function ensureIssueLink(body, issueNumber) {
  const text = String(body || '').trimEnd();
  const linked = linkedIssueNumbers(text);
  if (linked.includes(issueNumber)) return text;

  const relation = acceptanceChecklistComplete(text) && postMergeValidationComplete(text)
    ? `Dev-Completes: #${issueNumber}`
    : `Refs #${issueNumber}`;
  return `${text}\n\n## Issue linking\n${relation}\n`;
}

module.exports = {issueNumberFromPullRequest, linkedIssueNumbers, acceptanceChecklistComplete, postMergeValidationComplete, ensureIssueLink};
