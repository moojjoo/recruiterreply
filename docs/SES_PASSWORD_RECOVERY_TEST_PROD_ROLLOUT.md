# Issue #288 — Test/Production recovery rollout

## Status
Preparation only. **No Terraform apply, AWS secret write, container restart, or deployment authorized.**

## Architecture constraint
Dev, Test and Production currently share the API EC2 host managed by `envs/dev`, despite separate Terraform roots that describe potential dedicated instances. Do not apply `envs/test` or `envs/prod` blindly: their plans could create additional EC2/VPC infrastructure. Compare live state and review `infra/aws/terraform/MIGRATION.md` first.

## Read-only inventory
Run `AWS_REGION=us-east-1 bash scripts/check-ses-recovery-environments.sh` from an AWS identity with permission to describe the shared instance and inspect the three secrets. The script prints configuration presence only, not values. Confirm that secret JSON uses the expected flattened or nested keys; investigate discrepancies manually without printing values.

## Required before Test enablement
1. Capture deployed Dev/Test/Prod image digests and SHA, actual EC2 instance profile and effective runtime config; never print peppers, credentials, recovery tokens, or full secret JSON.
2. Compare Dev working SES identity and region to Test. Verify verified sender and actual EC2 role authorization for `ses:SendEmail`; IAM on a shared host is shared, so review its blast radius.
3. Review a Terraform plan against the **live shared-host state** for narrowly scoped SES permissions. Reject any plan that replaces the host, PostgreSQL storage, VPC or DNS.
4. Prepare Test-only Secrets Manager values for `PasswordRecovery:EmailEnabled`, `PasswordRecovery:FromEmail`, independent random `PasswordRecovery:CodePepper` (at least 32 bytes), `Frontend:BaseUrl=https://test.recruiterreply.com`, and region. Use secure secret-update tooling with no values in command output or Git.
5. Back up Test PostgreSQL; verify migration `20261011160000_AddPasswordRecoveries` applied to the Test database. Preserve existing recovery records and Data Protection keys.
6. With **explicit Test approval**, deploy the reviewed SHA, verify the real inbox, single-use code, 10-minute expiry, replay rejection, reset/login and no secret leakage in logs. Neutral HTTP 200 alone is not proof of delivery.

## Production gate
Only after Test evidence and **separate explicit Production approval**, configure Production-specific pepper and `Frontend:BaseUrl=https://recruiterreply.com`, check production DB backup/migration and deploy the approved artifact SHA. Confirm real delivery and rollback readiness. Never automatically enable or deploy Production from this PR.

## Rollback
Disable recovery email for the affected environment only via reviewed configuration; restore the prior image SHA if needed. Do not roll back a shared database schema destructively. Confirm Dev remains healthy after each operation.

## Automation follow-up
Add CI unit/integration coverage for recovery sender failures and neutral responses, plus a safe configuration/plan-drift report. Do not send real email in CI.
