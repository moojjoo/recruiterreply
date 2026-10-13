# PR auto-merge policy (issue #369)

Trusted default-branch automation checks changed file metadata, current-SHA CI checks, implementation evidence, completed acceptance criteria, dependencies, review threads and branch protection.

- **Low:** Markdown documentation and frontend CSS/SCSS. Eligible for protected squash auto-merge.
- **Medium:** Allowlisted application source and tests, excluding sensitive paths. Eligible after required checks.
- **High:** Terraform, GitHub workflows, IAM, auth, security, payments, Stripe, deployment, dependencies, migrations, unknown paths, deletions and other unclassified files. Manual review and merge required.

The workflow applies `execute-dev` for managed PRs and `automation-ready` only for low/medium PRs with evidence and complete acceptance criteria. Labels never bypass policy or branch protections. PRs must not be drafts. Enable GitHub's Allow auto-merge setting for protected auto-merge to function; required human reviews may still block it. Test and Production approval gates remain unchanged.

Emergency stop: disable **Execute PR Automation** in GitHub Actions or tighten branch protection. Never bypass branch rules. Local test: `node --test .github/scripts/pr-readiness.test.cjs`.

Path-based checks cannot prove code is harmless. Review the allowlist when repository structure changes.
