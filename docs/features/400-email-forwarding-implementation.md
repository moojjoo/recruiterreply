# Issue #400 — Inbound catch-all forwarding

## Owner-approved behavior

All inbound recipients at `@recruiterreply.com` forward to `robert.dannelly@dannellysolutions.com` through ImprovMX's free plan. The owner expanded the original two-alias scope on 2026-10-17. Keep the `*` alias; optional explicit `privacy` and `legal` aliases must use the same destination. No other explicit aliases or mailboxes are required. This does not change outbound application senders.

The [free plan](https://improvmx.com/pricing/) currently includes one domain, 25 aliases, 500 forwards/day, and API access. Forwarding pauses at its quota; paid branded sending is not included. Forwarding alone does not provide branded replies. Account signup and destination ownership/verification belong to the owner. Do not send credentials through chat.

## Live inventory and reviewed DNS plan (2026-10-17)

- Route 53 authoritative zone: `Z03382853SGMP0RST8DJG` (`recruiterreply.com`).
- No apex MX or SPF record was present. Existing apex TXT contains Google site verification.
- SES reports verified sending and successful DKIM using three existing CNAMEs; no custom MAIL FROM domain is configured. No DMARC record was present; this feature does not introduce or change DMARC policy.
- Four existing remote Terraform state files were inspected for Route 53 ownership: none owns apex MX/TXT.
- A read-only live DNS plan passed the resource contract: import/update the existing apex TXT, preserving Google verification and adding one `v=spf1 include:amazonses.com include:spf.improvmx.com ~all`; create MX `10 mx1.improvmx.com` and `20 mx2.improvmx.com`, TTL 300.
- The separately approved IAM bootstrap has been applied and verified. In [run 39060498891](https://github.com/moojjoo/recruiterreply/actions/runs/39060498891), both protected Production stages received owner approval. The exact DNS plan applied successfully and authoritative DNS/SES checks passed. Provider readiness then failed before any test messages were sent.

The separate root `infra/aws/terraform/email-forwarding/` owns only these two record sets, with S3 state key `recruiterreply/email-forwarding/terraform.tfstate`. Import is declarative, not overwrite-on-create. `prevent_destroy` blocks accidental removal. Existing website/API records, SES DKIM and MAIL FROM configuration are excluded from this root. Before any apply, the plan gate rejects other resources, destructive actions, alternate routing, unknown values, or an unreviewed apex baseline. If another operator adds a TXT verification value, stop and review preservation instead of overwriting it.

## Bootstrap and protected environments

IAM is a separate, owner-approved bootstrap root at `infra/aws/terraform/email-forwarding-iam/`, with state key `recruiterreply/email-forwarding-iam/terraform.tfstate`. It reuses the existing GitHub OIDC provider and defines `RecruiterReply-Terraform-Dev`, `RecruiterReply-Terraform-Test`, and `RecruiterReply-Terraform-Prod`, plus a separate read-only `RecruiterReply-Terraform-ProdPlan` role. No static AWS credentials are used. Do not apply IAM until its exact plan is reviewed and explicitly approved. Normal global Terraform inputs do not create or remove these roles.

Each trust policy requires the exact repository/environment OIDC subject and `aud=sts.amazonaws.com`. Dev/Test roles read only the isolated DNS state and public DNS/SES metadata. Only Prod can write that state/lock and create/upsert apex MX/TXT. It cannot delete DNS records or mutate other record names/types. Its SES send permission is restricted to the two published aliases and generated `rr400-catchall-*` acceptance recipients, from `no-reply@recruiterreply.com`.

Before workflow execution, create these GitHub environments deliberately (the workflow refuses missing/unverifiable protection):

| Environment | Role variable `TERRAFORM_EMAIL_ROLE_ARN` | Protection |
| --- | --- | --- |
| `terraform-email-dev-plan` | Dev role ARN | Exact `main` branch only |
| `terraform-email-test-plan` | Test role ARN | Exact `main`, required reviewer, admin bypass disabled |
| `terraform-email-prod-plan` | ProdPlan role ARN | Exact `main`, required reviewer, admin bypass disabled |
| `terraform-email-prod-apply` | Prod role ARN | Exact `main`, required reviewer, admin bypass disabled |

A solo owner may approve their own run; the explicit approval is still required. Restrict protected-environment workflow access through repository rules and reviewed `main` changes. OIDC environment subjects do not independently encode branch or workflow identity. Plan jobs use a restrictive read-only session policy in addition to read-only IAM roles. The write-capable Prod role trusts only the apply environment, so a plan job cannot obtain writes by omitting its session policy. The apply job receives writes only after the separate protected apply approval.

Store the ImprovMX API credential as environment secret `IMPROVMX_API_KEY` in `terraform-email-prod-apply`. Obtain it from the [provider API page](https://app.improvmx.com/api). Use read-only permissions if offered. This implementation performs three bounded authenticated GETs (account, domain, complete aliases), never upgrades a plan and never requests message logs. It checks price zero, catch-all destination, complete alias inventory, and explicit alias-based routing. The optional `rules_fallback_email` metadata may be absent, null, empty, or the same approved inbox; different destinations or malformed values are rejected. Empty metadata does not substitute for the required catch-all inventory, and rules-based/disabled routing is still rejected. Provider responses and credentials are withheld from logs. An arbitrary manually written JSON is not deployment evidence.

To diagnose provider configuration before DNS activation, dispatch `operation=provider-check`, `email_environment=prod`. This uses the existing protected secret environment and requires its reviewer approval, but the job has no AWS/OIDC permissions or Terraform steps. Plan/apply jobs are skipped for this operation. Failures report only an allowlisted reason code, a fixed endpoint label, and an HTTP status when available. For example, `HTTP_FAILURE stage=account HTTP=401` identifies an authentication failure; `ALIAS_ROUTING_NOT_ACTIVE` identifies a routing validation failure. Error bodies, original exceptions, actual account fields, alias destinations, and credential values are never printed. This mode retains every existing provider validation requirement.

## Workflow and exact-plan approval

The existing `.github/workflows/terraform-readonly-audit.yml` and its four-root read-only audit remain intact. `.github/workflows/email-forwarding.yml` extends the same GitHub Actions/Terraform/OIDC setup with the scoped Issue #400 plan/apply jobs. PRs run unprivileged validation only. On `main`, dispatch `operation=email-plan` with `email_environment=dev|test|prod` to inspect DNS. Dev/Test have no ability to apply shared Production apex DNS.

For an explicitly approved Production DNS change, dispatch `operation=email-apply`, `email_environment=prod`. The plan job snapshots public DNS/SES metadata, creates a saved binary plan and seals its SHA-256, commit, environment, creation time, and semantic plan signature. The one-day artifact contains only this isolated public-DNS plan and public baseline, never the global application state or provider credentials. Review the sanitized plan summary before approving `terraform-email-prod-apply`.

Apply downloads only the same run/attempt artifact, checks provider configuration, regenerates a fresh plan, enforces the same resource contract, compares refreshed prior state/drift/changes, rejects approvals older than one hour or hash/SHA/environment mismatches, and applies only the original reviewed binary. Re-run the plan after expiry. Terraform S3 locking and saved-plan state serial checks also apply. Workflow concurrency serializes applies. External DNS changes after the final fresh check remain an operational race; avoid concurrent manual DNS changes. A failed apply requires read-only inspection, not an automatic rollback.

## Acceptance and receipt verification

After apply, check all authoritative nameservers for MX, single merged SPF, preserved TXT, the three SES DKIM CNAMEs, and unchanged DMARC presence/value. Compare all other Route 53 records and SES DKIM/MAIL FROM metadata to the pre-plan snapshot. Provider forwarding readiness must pass. A newly propagated DNS value may require a later read-only retry; do not repeat apply just to wait for DNS.

To resume after a successful DNS apply, dispatch `operation=email-acceptance`, `email_environment=prod`, and `source_run=39060498891` (or the actual applied source run). Approve the existing protected `terraform-email-prod-apply` environment for this acceptance job. Plan/apply jobs are skipped. The job authenticates the original workflow run, requires successful apply and DNS-check steps on an ancestor of the current `main` commit, and downloads only that run/attempt's original artifact. It checks the original plan digest, commit and Production binding before using the public baseline. An expired/deleted artifact requires separate investigation; do not substitute a newly invented baseline.

Acceptance does not initialize Terraform or write DNS/state. Its AWS session permits public DNS/SES reads and the three already restricted SES test recipients only. Provider checks use at most six read-only attempts, 30 seconds apart, retrying only pending forwarding readiness. Account, credential or alias validation failures stop immediately. The same bounded readiness wait is used after future initial applies. Acceptance sends are disabled on workflow reruns; any further send requires a new protected dispatch and approval. Correlation IDs/timestamps are retained in a one-day receipt artifact.

Send at most three uniquely tagged messages per authorized acceptance run: `privacy`, `legal`, and a generated `rr400-catchall-<id>` recipient. Publish only correlation IDs/timestamps. SES acceptance and provider readiness do not prove final inbox receipt. The workflow deliberately fails the final acceptance gate with **PENDING MANUAL VERIFICATION** until the owner confirms all three IDs in the destination inbox. Do not close #400 or declare the forwarding accepted based only on apply/SMTP success. No inbox API is connected or authorized.

The four protected GitHub environments have been created and their main-branch/reviewer protections verified. The owner-approved IAM bootstrap is complete: four roles and policies match the reviewed plan, Terraform reports no IAM changes, and 19 live permission simulations passed. Dev and Production planning OIDC runs passed. The free provider account and approved catch-all inventory passed the apply preflight; DNS apply and preservation checks passed. Provider readiness and final inbox receipt remain pending. Test/Production application promotion is not part of this change.

## Rollback

No automatic Production DNS rollback. The public pre-plan snapshot is the recovery reference. With separate explicit owner approval, produce a new reviewed plan restoring the exact original TXT set and removing/replacing only the new MX record. That deliberate removal requires a separately reviewed lifecycle/IAM change because the normal configuration prevents destroy and the execution role disallows DNS DELETE. Preserve Google verification, SES records, website/API records and unrelated later changes. Do not destroy the hosted zone or global infrastructure. Disable provider forwarding only after the approved DNS rollback has propagated.

## Local verification

```bash
node --test scripts/email-forwarding/*.test.cjs
python3 -m unittest discover -s scripts/email-forwarding -p 'test_*.py'
terraform -chdir=infra/aws/terraform/email-forwarding fmt -check
terraform -chdir=infra/aws/terraform/email-forwarding-iam fmt -check
```

Initialize each root with `-backend=false -lockfile=readonly` before standalone `terraform validate`. Unit tests cover catch-all and destination restrictions, free-plan/provider inventory, unauthorized resources/record values, destructive actions, stale or tampered plans, changed SHA/environment, changed refreshed state, main-branch/reviewer protections, unrelated DNS/SES changes, and bounded test recipients.
