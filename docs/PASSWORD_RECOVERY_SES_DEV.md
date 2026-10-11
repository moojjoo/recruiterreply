# Issue #275: AWS SES Dev-only recovery preflight

**Status: blocked on AWS-side verification and real inbox receipt.** Repository review confirms `SesRecoveryEmailSender` uses SES v2 and `PasswordRecoveryController` returns neutral HTTP 200 when disabled, misconfigured, unknown user, throttled or failed delivery. HTTP 200 is not proof of delivery.

## Safe read-only AWS checks

Run `AWS_REGION=us-east-1 SES_FROM_EMAIL=your-verified-sender@example.com bash scripts/check-ses-recovery-dev.sh` with an AWS CLI identity authorized to read SES account and identity metadata. Script does not send email or print secrets. Confirm the SES region actually used by the Dev container; do not assume us-east-1 if configured differently.

If SES is in sandbox, verify the intended recipient in the **same SES region** or request production access. Confirm verified sender identity (domain or address), SPF/DKIM alignment, and account sending status. Check CloudWatch/SES delivery, bounce and complaint signals without exposing email addresses in application logs.

## Required owner-reviewed Dev configuration

- Grant EC2 runtime role `ses:SendEmail` on the exact SES verified sender identity ARN, scoped to the Dev runtime role; review any additional IAM condition restrictions before applying. No wildcard resource unless SES behavior requires and risk is documented.
- Supply `PasswordRecovery:EmailEnabled`, `PasswordRecovery:FromEmail`, `PasswordRecovery:CodePepper` (32+ cryptographically random characters), `Frontend:BaseUrl` (Dev HTTPS origin), and region through Dev-specific secret/config wiring. Never commit pepper, AWS credentials, reset tokens or email content.
- Review `20261011160000_AddPasswordRecoveries` migration and Dev database backup/rollback before enabling. Check the runtime's actual env mappings and AWS SDK region resolution.
- Review `docs/PASSWORD_RECOVERY.md` security follow-ups: proxy-aware rate limits, replay/concurrency, log redaction, fake sender tests, expiry cleanup and abuse monitoring.

## End-to-end verification (requires explicit owner approval)

1. Verify the Dev account exists and its email address is correct without sharing credentials or private logs.
2. After SES verification, least-privilege IAM and Dev-only secret setup, enable Dev email sending under owner approval.
3. Request password recovery once, confirm **actual inbox receipt**, verify 10-minute expiry and successful single use, reject replay, and test login with new password.
4. On failure, review SES account restrictions, sender identity, runtime role permission and redacted error category; preserve neutral public responses.
5. Keep Test and Production untouched; disable Dev sending for rollback if necessary.

**Cost:** SES message charges are usage-dependent; check AWS pricing and any free tier. This PR provisions no paid services.
