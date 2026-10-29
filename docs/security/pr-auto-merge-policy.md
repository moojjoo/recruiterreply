# PR auto-merge policy (issue #369)

Trusted default-branch automation checks changed file metadata, current-SHA CI checks, implementation evidence, completed acceptance criteria, dependencies, review threads and branch protection.

- **Low:** Markdown documentation and frontend CSS/SCSS. Eligible for protected squash auto-merge.
- **Medium:** Allowlisted application source and tests, excluding sensitive paths. Eligible after required checks.
- **High:** Terraform, GitHub workflows, IAM, auth, security, payments, Stripe, deployment, dependencies, migrations, unknown paths, deletions and other unclassified files. Manual review remains the default. An explicit repository-owner `/execute-dev <issue>` command may authorize one protected merge for one linked PR head SHA after every other gate passes.

The workflow applies `execute-dev` for managed PRs and `automation-ready` only when evidence and acceptance criteria are complete. Labels never constitute owner authorization and never bypass policy or branch protections. For a high-risk PR, the command must be an exact PR comment from the repository owner and match the linked issue. Trusted default-branch automation records an authorization scoped to repository, issue, PR, owner, and current head SHA. It expires after 24 hours, becomes invalid after any push, and can be revoked with `/revoke-execute-dev <issue>`. High-risk changes are merged through GitHub's protected merge endpoint with the expected head SHA; GitHub rejects a concurrent push atomically. The workflow removes any pre-existing auto-merge request first so an earlier authorization cannot survive expiry, revocation, or a later SHA. A bot marker copied or edited by a contributor is untrusted.

Required checks are classified as pending, failed, or missing for the exact current SHA. Concurrent completion events are serialized, and the workflow rereads the PR head immediately before a protected merge decision. A SHA change fails closed and requires new checks plus a renewed high-risk authorization. Review submissions, review dismissals, and review-thread resolution trigger reevaluation. The PR status comment identifies the current blocker and next step.

PRs must not be drafts. Enable GitHub's Allow auto-merge setting for protected auto-merge to function; required human reviews, unresolved threads, merge queues, branch protection, and environment rules remain authoritative. Test and Production approval gates remain unchanged.

Emergency stop: disable **Execute PR Automation** in GitHub Actions or tighten branch protection. Never bypass branch rules. Local test: `node --test .github/scripts/pr-readiness.test.cjs`.

Path-based checks cannot prove code is harmless. Owner authorization is a narrowly scoped release decision, not a claim that the code is low risk. Review the allowlist when repository structure changes.
