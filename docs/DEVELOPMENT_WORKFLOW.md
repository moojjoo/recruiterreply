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
5. **Review:** coding agent opens a ready-for-review PR, addresses any review findings and passes required checks; Copilot review is optional, not a blocking requirement for a solo developer. For `/execute`, the owner's instruction authorizes merge and deployment to **dev** so the owner can inspect the running feature there; Windows + VS Code review is optional for dev.
6. **Release:** follow the repository's **existing** GitHub Actions build and promotion process; do not alter workflows or promote to production without explicit authorization.
7. **Close:** merge the validated PR under the authorized `/execute` dev workflow, link it to the issue, and close the issue when acceptance criteria are met. Test and production require separate explicit owner approval.

## Build and DEV deployment workflow

- Feature-branch pushes run `verify` only.
- Pull requests targeting `main` run `verify` only.
- Pushes to `main` run `verify`, then `build`, then `deploy-dev`.
- Manual dispatch runs `verify` on any branch, but runs `build` and `deploy-dev` only when dispatched on `main`.

## Feature-log priority and execution queue

GitHub Issues remain the feature log, while the linked **RecruiterReply MVP** GitHub Project (Project 2) is the authoritative active execution queue. The `Next Up` view is filtered to open Todo items and excludes Blocked items. Use the Project's `Priority` and numeric `Execution rank` fields to order eligible work; sort by Priority and then Execution rank in the Project UI. The historical labels remain during migration and for compatibility, but `order:NN` is no longer the primary queue.

Every new feature, bug, security task, or documentation task must include exactly one priority label and a temporary execution-order label before implementation begins:

- `priority:P0` — security exposure, data loss, production/release blocker, or a prerequisite for protecting an environment.
- `priority:P1` — reliability, operational correctness, supportability, or an important feature whose failure does not immediately create a security or release blocker.
- `priority:P2` — user experience, analytics, polish, or other non-blocking improvements.
- `order:NN` — compatibility/history only during the Project migration; lower numbers previously executed first.

Assign the highest applicable priority when an issue spans categories. Set the Project `Priority` field to match the label and assign a unique numeric `Execution rank` after considering dependencies: security and environment-perimeter prerequisites precede dependent authentication and release work; reliability and observability follow their prerequisites; experience and analytics follow the release path. Keep `order:NN` aligned temporarily, but do not renumber the Project queue solely to preserve labels. Closed issues retain their historical labels and are not eligible for `Next Up`.

The issue body must state the priority rationale and list dependencies. Before `/execute` or `/execute-dev`, verify that the issue has the required `priority:*`, `phase:*`, and Project membership with `Priority`, `Execution rank`, and `Status` values. Reconcile the Project fields and compatibility labels whenever dependencies, scope, or completion status changes. Record blocked-by relationships using GitHub issue dependencies when available.

Project 2 has automatic intake and closed-item workflows enabled. New qualifying issues should enter as Todo; closing an issue should move it to Done and remove it from the active view. These workflows must not be weakened. If GitHub automation cannot be configured through the available tooling, document the missing permission and leave the existing workflow unchanged rather than approximating it in repository Actions.

## Issue template (copy into GitHub)

**Priority:** `P0`, `P1`, or `P2`, with a short rationale based on the feature log.

**Execution order:** Project `Execution rank`, including why this issue precedes or follows its dependencies. Keep a matching `order:NN` label temporarily for compatibility.

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
- Owner invocation of `/execute <issue>` expressly authorizes coding-agent source modifications, validated PR merge and deployment **to dev only** via existing GitHub Actions. Never bypass required checks or protection rules. Changes to GitHub Actions workflows, manual AWS deployments, and promotions to test/prod require separate explicit owner approval.

## Owner-approved solo-developer automation (#256)

- `/execute <issue>` and `/execute-dev <issue>` authorize implementation on a feature branch, a ready-for-review PR, CI-gated auto-merge, and deployment to Dev using the existing `main` push workflow.
- Apply the `execute-dev` PR label to opt in to the existing automation; it checks successful verify, Playwright and CodeQL checks and unresolved review threads. GitHub branch protection remains authoritative.
- A Copilot reviewer is optional and must not block a solo developer's CI-gated PR merge. A failed or pending check prevents merge.
- `/execute test` and `/execute prod` require separate owner commands and promote the approved immutable SHA; never automatically promote them.
- If required GitHub rules/settings cannot be verified through repository permissions, validate them in repository Settings before claiming enforcement.
