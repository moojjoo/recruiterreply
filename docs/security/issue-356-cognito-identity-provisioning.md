# Issue #356 — Opt-in Cognito identity provisioning

This change wires the existing Cognito identity module into the global Terraform root, **disabled by default**. It provisions separate invite-only Dev and Test pools with password + email OTP MFA when explicitly enabled. It does **not** create a CloudFront edge gate or reopen Dev/Test.

## Preflight

- Confirm Dev and Test CloudFront remain disabled and Production remains enabled using `bash .github/scripts/verify-private-environment-lockdown.sh`.
- Confirm verified SES sender and SES identity in us-east-1; check sandbox/production SES delivery limits and Cognito EMAIL_OTP support for the pinned AWS provider.
- Check costs for Cognito Essentials and email MFA.
- Use a separate globally unique hosted domain prefix for each pool. Never put OTP, passwords or secrets in Terraform variables or output.
- Run `terraform fmt -check`, `terraform init`, `terraform validate` and review `terraform plan` from `infra/aws/terraform/global`. Do not apply without explicit approval.

## Example opt-in variables (do not commit real values)

```hcl
enable_private_environment_identity = true
private_environment_ses_from_email  = "verified-sender@example.com"
private_environment_ses_source_arn  = "arn:aws:ses:us-east-1:ACCOUNT:identity/example.com"
private_environment_cognito_domain_prefixes = {
  dev  = "unique-recruiterreply-dev-login"
  test = "unique-recruiterreply-test-login"
}
```

When enabled, only the identity resources should be newly created; the plan must show **no CloudFront distribution enabling or production changes**. Account invitations must be made by an authorized administrator; no users are created automatically.

## Still blocking access restoration

- Implement CloudFront viewer-request authentication on every path and distribution hostname, preserving SPA rewrites and noindex.
- Implement secure OAuth authorization-code/PKCE callbacks, verified tokens, short-lived protected cookies, state/nonce, logout and revocation.
- Prevent unauthenticated API access through direct EC2 IP/hostname/ports (#357).
- Test invalid, expired and cross-environment sessions, caching, direct distribution access, SES delivery, CI compatibility and rollback.
- Obtain explicit authorization before any live apply or re-enable. Keep issue #356 open.
