# GitHub Actions Ubuntu 26 migration

Issue #387 records the October-November 2026 migration of the
`ubuntu-latest` label from Ubuntu 24.04 to Ubuntu 26.04.

## Current decision

The Terraform read-only audit is pinned temporarily to `ubuntu-24.04`. It is
the highest-risk compatibility path because it combines Terraform 1.14.3,
provider plugins, AWS CLI/OIDC authentication, remote state, and four
environment-protected roots. The pin prevents an unreviewed runner-image change
from altering audit behavior during the migration window.

The repository currently has 23 `ubuntu-latest` job declarations. This change
does not rewrite every runner label: application builds and promotion workflows
must be exercised independently before their labels move. After the Ubuntu
26.04 image is available, run an explicit compatibility PR that executes the
build, Playwright, CodeQL, Cognito edge, deployment packaging, and promotion
validation paths on `ubuntu-26.04`. Remove this audit pin only after all four
Terraform roots return the expected exit code and no tool/runtime regression is
observed.

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
5. Confirm the Test promotion workflow parses and its existing environment and
   immutable-SHA safeguards remain unchanged. Do not promote to Test as part of
   this issue.

## Rollback

If either upgraded action changes behavior, revert this maintenance commit to
restore the prior action major and runner label. Do not weaken OIDC trust,
environment approvals, read-only IAM, or Terraform plan safeguards as a
workaround.
