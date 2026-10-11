# Issue #259 — consent audit hardening verification

This follow-up adds unit coverage for server-side timestamps, pseudonymous fields, accepted transitions, withdrawal history, idempotent retries, conflicting replay, invalid payloads, and browser-origin rejection.

## Still required before completion
- PostgreSQL integration test that applies EF migrations to an isolated database and verifies rollback strategy.
- PostgreSQL integration test for ExecuteDeleteAsync retention cleanup (in-memory EF does not implement relational ExecuteDeleteAsync).
- HTTP pipeline integration test asserting 429 after 30 requests/minute, including reverse-proxy behavior and safe IP partitioning.
- Browser integration test simulating audit endpoint outage: rejection and withdrawal must still update consent locally and suppress analytics.
- Review trusted Origin configuration and production reverse-proxy headers; a missing Origin header is permitted for non-browser clients.
- Legal approval of retention duration and backup/deletion policy.

Do not close #259, auto-merge, or deploy Test/Prod based only on unit tests. This PR is a draft pending integration tests and security review.
