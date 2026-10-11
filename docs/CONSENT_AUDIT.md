# Consent audit events (#259)

The optional analytics preference remains client-side; each explicit change also sends a **best-effort**, unauthenticated POST to `/api/consent-events`. Reject and withdraw work even if the audit API fails. No email, account ID, IP address, user-agent, recruiter message or resume is written to the audit table. Consent IDs are random pseudonymous browser IDs and must still be treated as personal data where applicable. No identifying request data should be included in API logs.

The endpoint accepts an event UUID (idempotency key), browser consent UUID, action, analytics flag and notice version; it stamps server UTC time and limits requests to 30/minute per source address in memory. Reverse-proxy forwarding and application logs must be reviewed before relying on the limiter in production. The frontend uses the existing runtime API base URL, so identical build artifacts can be promoted.

## Schema and rollout

Additive EF migration `20261011150000_AddConsentAuditEvents` creates `consent_audit_events` with UUID primary key, consent UUID, action, analytics flag, policy version and server timestamp. Indexes support retention and pseudonymous lookup. Review generated SQL and backups before applying; **never run Down() against persistent data without explicit approval**. Existing Dev/Test `Database:AutoMigrate` settings may apply this migration at startup.

`ConsentAudit:RetentionDays` defaults to 365; valid range 30–3650. Background cleanup deletes expired audit records daily. This is an operational retention policy proposal, **not a legal determination**; have counsel confirm and document the policy, deletion requests, backup expiry and access controls. Retention may not erase older backup copies immediately. Retention service should be disabled or deferred if legal approval is not yet available.

Estimated additional AWS service charges: **$0** if using existing PostgreSQL and application hosts; incremental storage/CPU and logs may incur usage charges, expected to be small at early traffic volumes, not guaranteed below $5/month. No new AWS service is provisioned.

## Limitations / follow-up verification

- CI must verify migration, compilation, duplicate-event behavior, invalid requests, rate limiting, audit failure, and purge using representative PostgreSQL data.
- Review whether anonymous requests should be restricted to known Origin values and add CSRF/abuse protections before public release.
- Verify browser Dev/Test/Prod API URL configuration and audit request routing; check no PII in request logging.
- This is evidence of **client-reported choices**, not cryptographic proof of an individual's consent. Legal/compliance review remains pending (#260).
