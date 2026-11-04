'use strict';

/** Resolve the pull request targeted by a trusted workflow event payload. */
function resolveTargetPullRequestNumber(eventName, payload = {}) {
  if (eventName === 'pull_request_target' || eventName === 'pull_request_review') {
    return payload.pull_request?.number || null;
  }
  if (eventName === 'workflow_run') {
    const pullRequests = payload.workflow_run?.pull_requests;
    return Array.isArray(pullRequests) && pullRequests.length === 1
      ? pullRequests[0]?.number || null
      : null;
  }
  if (eventName === 'issue_comment' && payload.issue?.pull_request) {
    return payload.issue.number || null;
  }
  return null;
}

module.exports = {resolveTargetPullRequestNumber};
