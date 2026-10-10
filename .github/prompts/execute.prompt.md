---
name: execute
description: Implement a RecruiterReply GitHub issue, validate, merge when checks pass, and deploy to dev using existing GitHub Actions
agent: agent
---
# Execute RecruiterReply Issue

Repository: `moojjoo/recruiterreply`

Issue number: ${input:issueNumber:Enter GitHub issue number}

When invoked with `/execute` and an issue number, use that issue number. If missing, ask for it. Never silently substitute a different issue or PR number.

## 1. Discover and implement
1. Retrieve the GitHub issue and comments, verify it is open, and inspect existing branches/PRs to avoid duplicate work.
2. Read acceptance criteria and inspect the actual repository and tests. Clarify ambiguous or unsafe requirements before making changes.
3. Create `feature/<issue-number>-<slug>` from the current default branch. Make focused changes with appropriate tests, preserving existing behavior.
4. Run relevant lint, type checks, frontend build, backend tests, and any applicable integration/security checks. Fix introduced failures. Never report checks as passed unless they actually ran.
5. Commit and push the feature branch; create a PR against `main` with `Closes #<issue-number>`, test evidence, change summary, and risks. Assign the PR to repository owner `moojjoo` using GitHub's assignee capability when available. Reuse an existing open PR for the issue instead of creating a duplicate. A draft PR is a temporary implementation stage, not the final result of `/execute`.

## 2. Request Copilot code review automatically
1. Once the PR is ready for review (not a draft), request **GitHub Copilot** as a reviewer automatically using the GitHub PR review-request API (Copilot reviewer identity, where available). Do not request the PR author's own approval. If the repository supports GitHub's automatic Copilot code review setting, it may additionally trigger on PR creation or new pushes; do not assume it is enabled.
2. Confirm GitHub accepted the Copilot review request. Wait for the Copilot review when supported; read findings, address actionable issues, push fixes, and re-request review if needed. A Copilot comment is not a substitute for required status checks or repository branch protection.
3. If Copilot review is unavailable due to plan, repository settings, permissions, API support, or rate limits, report the limitation clearly. Never claim a review was requested or completed without GitHub confirmation. Follow existing required review/merge rules; do not bypass a mandatory review.

## 3. Validate, merge, and deploy to DEV
1. Inspect PR checks and Copilot review findings; require all applicable required checks to pass. Do not bypass branch protection or security checks.
2. If checks are pending, wait and recheck when supported. If failing, fix and rerun. If checks cannot be verified or necessary tests are missing (including feature-specific acceptance tests such as accessibility audits), stop and report the blocker rather than merging. Do not claim a generic CI pass proves feature-specific requirements.
3. When implementation is complete, feature-specific acceptance criteria are validated, required checks have passed, and no blockers remain, post a PR comment or update its summary with exactly `Approved` under a clearly labeled `Automated validation result` section, along with check evidence. This is a status record, NOT a formal GitHub approval review, and must not claim to be authored by `moojjoo` if posted by an automation or bot. Do not mark Approved if checks are incomplete, failing, or unknown.
4. Mark any draft PR ready for review, then merge the PR into `main` using the repository's supported merge strategy. **The user has authorized automatic merge and development deployment as part of the `/execute` workflow.** Do not merge unrelated PRs.
5. Use the EXISTING GitHub Actions workflow `.github/workflows/build.yml`. It runs verification and, on a `main` push, builds and deploys to `dev` via `.github/workflows/promote.yml`. Do not duplicate deployment logic or deploy manually to AWS.
6. Verify the relevant GitHub Actions run completed successfully, including its `deploy-dev` job. Where feasible, check `https://dev.recruiterreply.com` and affected API behavior. Report the commit SHA, run URL, deployment outcome, and any failures. A merge is not proof of successful deployment.

The user reviews changes in the deployed **dev environment**, not by manually reviewing PR code. Never require the user to review a PR before deploying to dev if all automated gates and repository protection rules allow merging. Always provide the dev URL and verification status after deployment.

## 4. TEST and PROD are separate
- `.github/workflows/promote-test.yml` promotes a validated commit SHA to `test` by manual `workflow_dispatch`.
- `.github/workflows/promote-prod.yml` promotes a SHA already verified on test to `prod` by manual `workflow_dispatch`.
- Do **not** automatically dispatch test or prod promotions. Ask for explicit environment-specific approval, confirm the exact SHA and successful prerequisite verification, and use only these existing workflows.
- Respect GitHub environment approvals and protection rules.

## Safety and execution rules
Proceed through ordinary edits, tests, PR creation, and **dev-only** merge/deployment automatically once all checks pass. Do not stop after planning.
Never bypass required checks, force-push shared history, expose or change secrets, run remote database migrations, change live AWS resources outside the approved existing dev pipeline, add paid infrastructure, or manually deploy to AWS without separate approval.
If permissions, tooling, GitHub Actions, or checks prevent completion, stop safely and explain what remains. Never claim deployment succeeded until its workflow has succeeded.
