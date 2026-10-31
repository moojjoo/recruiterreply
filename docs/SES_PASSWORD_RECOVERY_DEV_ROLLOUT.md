# Issue #275 — Dev AWS SES password recovery rollout

Status: **blocked pending live AWS checks and explicit owner approval**. Do not set `PasswordRecovery:EmailEnabled=true` until the gates below pass.

## Verified source behavior
- `PasswordRecoveryController.RequestRecovery` returns the same neutral HTTP 200 response when email sending is disabled, the user is missing, throttling applies, or SES delivery fails. HTTP 200 **does not** establish email delivery.
- `SesRecoveryEmailSender` uses AWS SDK SES v2 `SendEmailAsync` with the EC2 role's ambient credentials.
- The reset code expires after 10 minutes; requests are throttled and credentials are single-use.
- The multipart SES message contains a branded, mobile-friendly HTML part and a
  complete plain-text alternative. Both show the same six-digit code and expiry.
- The code is prominent and selectable without inserting spaces into its value.
  The email intentionally has no Copy button because major email clients block
  the JavaScript clipboard API. The reset page accepts normal paste and browser
  one-time-code autofill; it does not receive or expose the code in a URL.
- The existing migration must be reviewed before Dev deploy.

## Dev preflight (read-only)
1. Identify Dev EC2 instance profile and actual IAM role, SES region, and sender domain/address. Avoid displaying secrets.
2. Use AWS SES v2 `get-account --region <region>` to inspect production access / sandbox status; `list-email-identities` and `get-email-identity --email-identity <identity>` to verify sender status.
3. If SES sandbox is active, verify `rbdresume@gmail.com` as a recipient in the **same region**, or request SES production access. Never infer delivery from API acceptance.
4. Review IAM policy for the Dev EC2 role; allow only `ses:SendEmail` against the verified sender identity ARN in the selected region/account. Verify the role can assume it.
5. Confirm the Dev-only secret/config provider maps `PasswordRecovery:CodePepper` (random >=32 chars), `PasswordRecovery:FromEmail`, `Frontend:BaseUrl`, and region without committing credentials.
6. Confirm EF migration status, Dev backup, and rollback plan; check logging and reverse-proxy handling for token redaction and rate-limit integrity.

## Enablement and end-to-end test
1. Owner approves Dev activation after preflight and security review; enable only Dev `PasswordRecovery:EmailEnabled=true`.
2. Deploy Dev and inspect startup/SES error logs without printing email codes, tokens, secret values or reset URLs.
3. Request recovery for `rbdresume@gmail.com` from Dev. Verify **actual inbox receipt**, including spam check; SES API success alone is insufficient.
4. Complete password reset and sign-in; confirm second use fails, expired credentials fail, throttling works, and unknown-account response is indistinguishable.
5. If failed, disable the Dev feature flag, preserve logs stripped of PII and investigate SES suppression/bounce/sandbox and IAM errors.

## Promotion gate
No Test or Production change, credential change, migration, or workflow promotion without separate explicit owner approval. Keep region-scoped SES identity and IAM permissions environment-specific.
