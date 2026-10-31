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

The runner-pinning PR changed only runner labels. Job steps, action versions, triggers,
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

## Read-only audit IAM follow-up

The approved audit run [39050302424](https://github.com/moojjoo/recruiterreply/actions/runs/39050302424)
passed its Dev/Test/Prod jobs but failed global refresh and desired-state plans
with `cognito-idp:DescribeUserPool` denied. The deployed audit policy also lacks
Lambda and DynamoDB metadata reads for the private edge resources now in global
state. AWS IAM simulation confirms those denied reads; this is separate from
the resolved runner annotation.

The correction adds explicit metadata operations only:

- Cognito pool/client descriptions, MFA settings and tags for the two deployed
  Dev/Test pool IDs listed in `terraform_audit_role.tf`. These are deliberate,
  non-secret resource identifiers, independent of the opt-in creation flags.
- Cognito domain descriptions in the configured region. AWS does not support
  resource-level permissions for `DescribeUserPoolDomain`, so that operation
  alone requires `Resource = "*"` plus `aws:RequestedRegion`.
- Function descriptions, tags, published version inventory and code-signing metadata
  for the named Dev/Test edge functions.
- Table descriptions, backup settings, TTL and tags for the named Dev/Test OAuth
  replay tables. No item reads or writes are granted.

`DescribeUserPoolClient` can return client secrets, so the pool allowlist must
remain limited to the reviewed public browser-client pools. Both current
clients use `generate_secret = false`. Introducing confidential clients in
these pools requires a separate review. `GetFunction` can expose function
configuration and a code download URL; edge signing values remain in Secrets
Manager and are not granted through this policy. No user-record, secret-value,
Lambda invocation, infrastructure mutation, state-write or apply permission is
added. Existing state access, OIDC trust and environment approval stay intact.

Validate the provider-generated policy with IAM simulation: the intended reads
must be allowed, while unrelated pools/functions/tables, wrong-region domain
reads, user records, secret values, replay items, invocation and writes remain
denied. Capture a targeted plan for `aws_iam_role_policy.terraform_audit` and
confirm it contains exactly one in-place policy update with existing statements
preserved. Targeting is an exceptional IAM repair, not evidence that the full
root is reconciled. Keep snapshots, plans and state private and uncommitted.

A local read-only check with the administrative identity also found independent
root reconciliation issues: refresh-only detects drift in the Dev CloudFront
distribution and Test pool, and the default desired-state inputs disable the
private modules. That desired plan proposes removals and fails on existing
`prevent_destroy` guards. Do not apply it or remove those guards. The audit needs
reviewed non-secret rollout inputs and reviewed edge package artifacts matching
the intended Dev/Test configuration before a full desired-state conclusion is
possible. An IAM-only apply does not resolve that configuration mismatch.

Repository changes do not update live IAM. Apply the reviewed IAM-only plan only
after explicit owner authorization, then rerun the protected audit. Keep #387
open if any root has errors or unclassified plan differences. Known differences
may be tracked separately with owner approval; exit 2 is not a clean-drift result. Roll back only this
inline policy to its captured prior document if needed; keep the Ubuntu runner
pins and previously upgraded action versions.

References: [AWS Cognito IAM actions](https://docs.aws.amazon.com/service-authorization/latest/reference/list_cognito-idp.html)
and the pinned [Terraform AWS provider v6.60.0](https://github.com/hashicorp/terraform-provider-aws/tree/v6.60.0/internal/service).

## Rollback

If the runner-pin change causes a regression, revert its commit through a
reviewed PR. The previously upgraded action majors remain unchanged. Restoring
`ubuntu-latest` also restores exposure to GitHub’s automatic OS migration.
Do not weaken OIDC trust, environment approvals, read-only IAM, or Terraform
plan safeguards as a workaround.

## Reviewed global audit inputs

The global audit explicitly loads `.github/config/terraform-audit-global.json`
through `terraform-audit-inputs.py`. Its non-secret variables preserve the
reviewed Dev/Test rollout scope instead of using opt-out creation defaults.
These inputs are generated into a private runner-temporary `.tfvars.json` file,
referenced by `TF_CLI_ARGS_plan` only in the global matrix job. The same file is
used by both refresh-only and desired-state plans. It is not an auto-loaded
Terraform file, and ordinary Terraform defaults remain unchanged.

The helper reads the two named edge functions through the audit role, checks
their reported hashes against the committed allowlist, downloads their ZIPs,
and checks the actual bytes again. Private temporary ZIPs are linked through
the reviewed historical `/tmp` filenames to avoid false filename-only Lambda
updates. Existing files or links are never overwritten. It does not unpack or
execute the ZIPs,
invoke Lambda, read signing secrets or modify AWS. Only HTTPS AWS-hosted URLs
and redirects are accepted. A changed or tampered package fails closed until a
new checksum is reviewed. Signed URLs and raw AWS exceptions are not logged;
private ZIPs, variable files and plan logs are removed at job completion.

The allowlisted hashes identify deployed packages reviewed during #387. The Dev
package hash differs from a historical source hash in state; this is an explicit
comparison baseline, not proof that source, state and AWS are fully reconciled.
The owner approved tracking that and the three Cognito differences in
[#429](https://github.com/moojjoo/recruiterreply/issues/429). Neither this workflow
nor issue closure authorizes applying those changes. A successful audit with
exit 2 reports known drift/planned changes; only exit 0 reports no changes.

The existing protected environment, read-only role, no state migration, unlocked
plans, no apply, and sanitized summaries remain in force. To roll back this
input change, revert its PR; keep resource destruction protection intact. The
old default-input desired-state audit may again fail on protected resources.
