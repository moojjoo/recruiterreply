# GitHub Actions workflow inventory

Reviewed for issue #607 on 2026-11-08 against the workflows in `.github/workflows/`, repository references, and recent GitHub Actions runs.

## Disposition

All 21 repository workflow files have an active purpose. No workflow file met the evidence threshold for removal or disabling.

| Workflow | Trigger or caller | Disposition | Evidence |
| --- | --- | --- | --- |
| `build.yml` | Push, pull request, manual dispatch | Retain | Verify/build/Dev deployment path |
| `codeql.yml` | Push, pull request | Retain | Required security gate; recent successful runs |
| `cognito-edge-tests.yml` | Push, pull request, manual dispatch | Retain | Cognito edge regression checks |
| `consent-audit-integration.yml` | Pull request, manual dispatch | Retain | Recent successful pull-request runs |
| `dev-issue-reconciliation-report.yml` | Schedule, manual dispatch | Retain | Scheduled read-only reconciliation reports |
| `ecr-image-retention.yml` | Manual dispatch | Retain | Backend ECR retention operation |
| `email-forwarding.yml` | Pull request, manual dispatch | Retain | Plan/apply/acceptance workflow with protected inputs |
| `execute-pr-automation.yml` | PR, review, comment, workflow run | Retain | Protected merge and Dev execution automation; workflow token uses required repository Contents write permission |
| `frontend-seo.yml` | Pull request, manual dispatch | Retain | Frontend SEO validation |
| `image-retention.yml` | Manual dispatch | Retain | EC2 image retention operation |
| `issue-reconciliation-audit.yml` | Schedule, manual dispatch, workflow run | Retain | Read-only issue reconciliation audit |
| `lighthouse-baseline.yml` | Pull request, manual dispatch | Retain | Lighthouse performance baseline |
| `playwright.yml` | Push, pull request | Retain | Browser regression checks |
| `pr-readiness-tests.yml` | Push, pull request, manual dispatch | Retain | Required PR readiness contract tests |
| `private-environment-lockdown.yml` | Push, pull request, manual dispatch | Retain | Private environment guard |
| `promote-prod.yml` | Manual dispatch | Retain | Explicit Production promotion boundary |
| `promote-test.yml` | Manual dispatch | Retain | Explicit Test promotion boundary |
| `promote.yml` | Reusable workflow caller | Retain | Called by Dev, Test, and Production promotion paths |
| `reconcile-dev-acceptance.yml` | Issue label event | Retain | Explicit retry path for verified Dev acceptance |
| `rollback-prod.yml` | Manual dispatch | Retain | Guarded application rollback path |
| `terraform-readonly-audit.yml` | Manual dispatch | Retain | Protected read-only Terraform audit |

The two files shown in the historical generated reports were not repository workflows:

- `.github/workflows/workflows/codeql.yml` is a nonexistent path caused by the old heuristic report.
- The generated reports themselves were stale, included build output and dependency files, and were not authoritative workflow inventories.

## Dependency checks

- `promote.yml` is referenced by `build.yml`, `promote-test.yml`, and `promote-prod.yml`.
- The active workflow names and required checks are referenced by repository documentation and contract tests.
- Recent Actions history confirms use of the CI, security, SEO, reconciliation, promotion, rollback, retention, and audit paths.
- No workflow run history or audit evidence was deleted.

## Protected merge permission contract (issue #647)

`execute-pr-automation.yml` runs from trusted `main` and uses the GitHub Actions
workflow token for its protected SHA-bound REST merge. The token explicitly
grants `contents: write` because GitHub's merge endpoint requires repository
Contents write permission. This is the minimum repository permission needed for
that operation in the workflow; it does not bypass required reviews, required
checks, merge queues, branch protection, or environment rules. No personal
access token is used. A rejected merge remains a reported blocker and the
workflow fails closed.

## Label cleanup

The repository had six default labels with no issue or pull-request usage: `duplicate`, `good first issue`, `help wanted`, `invalid`, `question`, and `wontfix`. They are removed as unused. Labels with historical issue usage, pull-request usage, execution automation, phases, priorities, security, or GitHub Actions classification are retained.

## Rollback

This audit is documentation-only at the workflow-file level. Reverting the issue-linked PR restores the removed generated reports. Label restoration, if needed, is a repository-settings operation and does not affect workflow execution or run history.
