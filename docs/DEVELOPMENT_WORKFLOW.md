# Phone-first Planning → GitHub Issues → Feature Branches → Pull Requests

## What is an Issue versus a branch?

- **GitHub Issue:** describes a feature, bug or documentation task. It is the planning and discussion record; creating one does **not** change code.
- **Feature branch:** an isolated line of development created from `main` for the approved issue. Example: `feature_42_gmail_filtering`.
- **Pull request (PR):** proposes merging branch changes into `main`; provides a reviewable diff and CI results.

## Recommended solo-developer workflow

1. **Android / ChatGPT:** describe the idea; ask ChatGPT to inspect the latest GitHub files and existing issues before planning.
2. **Discuss:** define user value, scope, non-goals, acceptance criteria, affected frontend/backend/database components, security, cost and tests.
3. **Approve:** review the proposed Issue body before ChatGPT creates the issue.
4. **Implement:** after explicit approval, create a feature branch from `main` (or assign an authorized coding agent). Reference the issue number in the branch and PR.
5. **Review:** coding agent proposes changes in a PR. Use Windows + VS Code for final inspection, tests and approval.
6. **Release:** follow the repository's **existing** GitHub Actions build and promotion process; do not alter workflows or promote to production without explicit authorization.
7. **Close:** merge approved PR, link it to the issue, and close the issue when acceptance criteria are met.

## Build and DEV deployment workflow

- Feature-branch pushes run `verify` only.
- Pull requests targeting `main` run `verify` only.
- Pushes to `main` run `verify`, then `build`, then `deploy-dev`.
- Manual dispatch runs `verify` on any branch, but runs `build` and `deploy-dev` only when dispatched on `main`.

## Issue template (copy into GitHub)

**Problem / outcome:** What user problem are we solving?

**Current behavior:** What exists in the actual repository?

**Proposed behavior:** What changes, including what must *not* change?

**Scope:** Frontend / backend / database / integrations / documentation.

**Acceptance criteria:** Checkable behaviors and edge cases.

**Security and privacy:** Authentication, authorization, secrets, customer data.

**Database impact:** Migration? Backward compatible? Existing data preserved?

**Testing:** Unit, integration, end-to-end, and manual validation.

**Deployment:** Existing workflow only; no unauthorized promotion.

**Open questions:** Any decisions required before coding.

## Guardrails

- One focused issue and branch per independently reviewable change.
- Never commit `.env` values or secrets.
- Dev/test/prod secrets remain in AWS; local secrets remain local.
- Local HTTPS-only is a **desired future change**, not yet established by the repository.
- No destructive EF migrations without explicit review and approval.
- No coding-agent source modifications, GitHub Actions edits, or deployments without the owner's approval.
