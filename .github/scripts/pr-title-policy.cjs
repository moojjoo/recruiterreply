'use strict';

const TITLE_PATTERN = /^RR-([1-9]\d*):\s+\S(?:.*\S)?$/;

function validatePullRequestTitle(title, linkedIssueNumbers = []) {
  const match = String(title || '').match(TITLE_PATTERN);
  if (!match) {
    return {valid: false, reason: 'Title must match RR-<issue>: <summary> without zero padding'};
  }

  const issueNumber = Number(match[1]);
  const linked = new Set(linkedIssueNumbers.map(Number));
  if (!linked.has(issueNumber)) {
    return {valid: false, issueNumber, reason: 'Title issue must match a linked PR body issue'};
  }

  return {valid: true, issueNumber};
}

module.exports = {TITLE_PATTERN, validatePullRequestTitle};
