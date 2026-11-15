'use strict';

const COMMIT_PATTERN = /^(feat|fix|refactor|chore|docs|style|test)\(RR-([1-9]\d*)\):\s+\S(?:.*\S)?$/;

function validateCommitSubject(subject, issueNumber) {
  const match = String(subject || '').match(COMMIT_PATTERN);
  if (!match) {
    return {valid: false, reason: 'Commit must match type(RR-<issue>): <subject> without zero padding'};
  }

  const parsedIssueNumber = Number(match[2]);
  if (parsedIssueNumber !== Number(issueNumber)) {
    return {valid: false, issueNumber: parsedIssueNumber, reason: 'Commit issue must match the linked repository issue'};
  }

  return {valid: true, issueNumber: parsedIssueNumber, type: match[1]};
}

module.exports = {COMMIT_PATTERN, validateCommitSubject};
