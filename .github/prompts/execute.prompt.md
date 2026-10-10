---
name: execute
description: Implement a RecruiterReply GitHub issue, validate, and open a pull request
agent: agent
---
# Execute RecruiterReply Issue

Repository: moojjoo/recruiterreply

Issue number: ${input:issueNumber:Enter GitHub issue number}

When invoked with /execute and an issue number, use that issue number. If the number is not supplied, ask for it. Do not interpret a different issue number without confirmation.

1. Retrieve the issue and its comments; inspect existing branches and PRs to avoid duplicate work. Check dependencies and acceptance criteria.
2. Inspect actual repository code and existing patterns before editing. If issue requirements are ambiguous or unsafe, ask for clarification.
3. Branch from the correct default base as feature/<issue-number>-<slug>. Make minimal, maintainable changes satisfying the issue, including appropriate automated tests.
4. Run available lint, type checks, builds, and tests; fix introduced failures. Clearly distinguish checks actually run from checks not runnable.
5. Commit and push changes to the feature branch and open a PR against the appropriate base, with issue reference (Closes #<issue-number>), change summary, testing evidence, and risks. If push or PR creation is unavailable, report the blocker truthfully.
6. Report issue, branch, PR URL, validation results, and outstanding follow-ups.

Proceed through normal file edits, tests, commit, push, and PR creation without asking for approval at each step. Do not stop after planning.

Safety: Never merge, deploy, modify live AWS resources, run remote database migrations, change production secrets, force push, or incur new paid services without explicit approval. Never claim a test passed unless it ran successfully. Avoid unrelated refactoring and preserve existing behavior.
