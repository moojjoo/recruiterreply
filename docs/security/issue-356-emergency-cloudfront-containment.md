# Issue #356 — emergency CloudFront containment

Owner verified live state on 2026-10-13:

| Environment | Distribution | Enabled | Status |
| --- | --- | --- | --- |
| Dev | E2JWU1TLDA6YRS | false | Deployed |
| Test | E2IGR9MYMWVQFI | false | Deployed |
| Production | EHWW9BKSSF64L | true | Deployed |

Terraform previously set `enabled = true` for every frontend distribution. This PR changes that to keep Dev/Test disabled and Production enabled. **This PR does not implement Cognito login and does not restore access.**

## Before merge or Terraform apply

1. Review the actual global Terraform state and plan; confirm no unrelated resource replacement, IAM changes, S3 changes, or CloudFront association changes. Existing CloudFront distribution IDs must match.
2. Run `terraform fmt -check` and `terraform validate` in the correct Terraform root; check required CI and security scanning.
3. Obtain explicit approval for any Terraform apply. An apply must **not** enable Dev/Test or change Production.
4. Confirm the three live CloudFront distribution states again after apply.
5. Pause or adjust Dev/Test promotion and smoke checks during outage. Do not silently bypass security checks.
6. Do not close #356 until Cognito password + native email MFA, edge request enforcement, sessions, API security, full negative tests, and controlled Dev/Test re-enable are complete.

**Never switch nonproduction `enabled` to true as a shortcut.** First implement and validate edge authentication on all paths and distribution hostnames, preserve noindex and SPA routing, verify cache-safe authorization, and get release approval.
