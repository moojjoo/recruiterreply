# Password recovery (#217)

Implements email-first recovery for email/password and Google-only accounts. The user can request a 10-minute, single-use six-digit code or a high-entropy token link. Codes are salted with a per-record UUID and secret server pepper before hashing. Tokens are SHA-256 hashed at rest. Recovery attempts are capped at five per issuance, request throttling is two minutes per account, and the API has an IP-based 5-per-15-minute limiter. Requests return neutral responses.

**Deployment is disabled by default**: set `PasswordRecovery:EmailEnabled=true` only after AWS SES verification, deliverability, abuse review and owner approval. Set `PasswordRecovery:FromEmail`, `PasswordRecovery:CodePepper` (32+ unpredictable characters in Secrets Manager), `Frontend:BaseUrl` (trusted HTTPS origin) and AWS region. Never log codes or link tokens. Do not use email link query parameters in analytics or server logs. The reset page should be served with `Referrer-Policy: no-referrer`.

The backend's EC2 IAM role needs narrowly scoped `ses:SendEmail` for the verified SES identity. This permission is **not yet provisioned** and should be reviewed separately with infrastructure owner before enabling sending. A new additive migration `20261011160000_AddPasswordRecoveries` is included; review before applying, especially with automatic Dev migrations. Do not apply to Test/Prod without explicit approval.

SMS is not implemented; it needs a verified phone number, provider selection, spend controls and explicit owner approval. Browser OTP autofill is enabled via `autocomplete=one-time-code`. Manual clipboard paste works without clipboard permissions. No real email is sent in CI.

Security follow-ups before enabling public recovery: fake-sender integration tests, concurrent replay tests on PostgreSQL, recovery token/code log redaction, proxy-aware rate limiting, background cleanup of expired records, audit logging of recovery success/failure without secrets, and email abuse monitoring.
