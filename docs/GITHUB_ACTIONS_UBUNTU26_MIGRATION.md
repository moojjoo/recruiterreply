# GitHub Actions Ubuntu 26 migration

Issue #387 records the October-November 2026 migration of the
`ubuntu-latest` label from Ubuntu 24.04 to Ubuntu 26.04.

## Current decision

All Linux jobs are explicitly pinned to `ubuntu-24.04`, including Test
promotion's `resolve-source`, image preflight, and the reusable promotion job.
This replaces the remaining 22 `ubuntu-latest` job declarations. The Terraform
read-only audit already used the same pin. Explicit labels prevent the automatic
October 19–November 19, 2026 image migration from changing the runner OS and
remove the associated floating-label migration annotation on new runs.

Only runner labels change in the workflows. Job steps, action versions, triggers,
permissions, environment protections, immutable release selection, OIDC role
assumption, and deployment gates retain their existing configuration.

## Follow-up: validate Ubuntu 26.04 before removing pins

Ubuntu 26.04 is generally available according to the upstream announcement.
Use a separate compatibility PR with explicit `ubuntu-26.04` runners to exercise
builds, Playwright, CodeQL, Cognito edge tests, deployment packaging, and promotion
validation. Test promotion validation without deploying or promoting to Test or
Production. Validate the Terraform audit on all four roots with its read-only
role and no apply. Capture workflow URLs and tool/runtime compatibility evidence
before replacing any `ubuntu-24.04` pin. An OS version pin still receives GitHub
image updates within Ubuntu 24.04; it does not freeze all installed tools.

Upstream migration announcement:
https://github.com/actions/runner-images/issues/14748

## Node.js action inventory

- `hashicorp/setup-terraform@v3` existed only in the Terraform audit and is
  upgraded to v4, whose documented breaking change is the Node.js 24 runtime.
- `aws-actions/configure-aws-credentials@v4` existed in the Terraform audit and
  Test promotion workflow. Both are upgraded to v6, whose documented breaking
  change is the Node.js 24 runtime.
- Other checked-in action references already use maintained Node.js 24-capable
  majors or are outside the two deprecation warnings observed in audit run
  38489625851.
- The repository convention is major-version action tags, so this maintenance
  keeps that convention instead of introducing isolated commit-SHA pins.

## Required validation

1. Run the Terraform read-only audit manually and retain its workflow URL.
2. Confirm global, Dev, Test, and Prod refresh-only and desired-state plans exit
   `0` when infrastructure is unchanged.
3. Confirm OIDC still assumes `TERRAFORM_AUDIT_ROLE_ARN` and no Node.js 20
   deprecation warning appears.
4. Do not run `terraform apply`; the workflow must retain no apply command,
   state migration, write credentials, or plan artifacts.
5. Parse every changed workflow and compare its structure against the base:
   only `runs-on: ubuntu-latest` to `runs-on: ubuntu-24.04` may differ.
6. Run the existing workflow policy, private-environment lockdown, and smoke
   regression tests. Confirm new CI runs use Ubuntu 24.04 and do not emit the
   floating-label migration annotation.
7. Confirm Test promotion retains its environment and immutable-SHA safeguards.
   Do not promote to Test or Production as part of this issue.

## Rollback

If the runner-pin change causes a regression, revert its commit through a
reviewed PR. The previously upgraded action majors remain unchanged. Restoring
`ubuntu-latest` also restores exposure to GitHub’s automatic OS migration.
Do not weaken OIDC trust, environment approvals, read-only IAM, or Terraform
plan safeguards as a workaround.
