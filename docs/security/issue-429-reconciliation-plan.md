# Issue #429 — private-environment reconciliation plan

Status: read-only evidence captured on 2026-10-17. This document does not
authorize Terraform apply, Cognito updates, Lambda publication, CloudFront
changes, DNS changes, state mutation, or Test/Production promotion.

## Evidence baseline

The reviewed source is `main` at `0da7de7`. The live metadata below was read
from account `178522450316`, region `us-east-1`, using the exact resource IDs
allowlisted by the Terraform audit role. Secret values, user records, replay
items, and signed package URLs were not read.

| Resource | Source/reviewed value | Live value | Classification |
| --- | --- | --- | --- |
| Dev pool `us-east-1_bMcYQWq8U` MFA | `ON`; native email MFA | `ON`; native email MFA | No functional MFA drift |
| Dev pool email MFA template | Branded HTML template, subject `RecruiterReply dev sign-in verification`, ten-minute text | Plain-text legacy template, same subject | Genuine pending desired-state drift |
| Dev browser client `ettkk9oq9ijnqi34rm3plqf5t` session | `auth_session_validity = 10` minutes | `3` minutes | Genuine pending desired-state drift |
| Test pool `us-east-1_OUaaIhK6h` MFA | `ON`; native email MFA | `ON`; native email MFA | No functional MFA drift |
| Test pool sender | `no-reply@recruiterreply.com` | `noreply@recruiterreply.com` | Genuine sender configuration drift |
| Test email MFA template | Branded HTML template, ten-minute text | Matches reviewed branded HTML template | No template drift |
| Dev edge package | Prior audit allowlist: `7SKe...`; current reviewed OIDC package: `dfPe...` | Version 4: `dfPe7ShuRqNTx/5+XcF5yUzeSipPZICjHieyFUmYVeM=` | Metadata-only allowlist drift |
| Test edge package | `QyiSoq0PX/TZf30HknBpLZM/ry1Uv9IjMbUFgHbb64o=` | Version 1: same hash | No package drift |

The live Dev CloudFront distribution is `Deployed`, remains enabled for the
`dev.recruiterreply.com` alias, redirects HTTP to HTTPS, and associates both
viewer-request and origin-response with
`recruiterreply-dev-private-edge:4`. The live Dev package hash was reproduced
from the reviewed local OIDC package before this metadata update. The Test
replay table is active and pay-per-request; neither replay table has deletion
protection, matching the disposable replay-state design.

## Proposed reconciliation

1. Keep the current Dev/Test MFA requirement, admin-only recovery, hosted
   domains, callbacks, origin protections, and CloudFront associations.
2. In a separately approved Terraform apply, reconcile the Dev email-MFA
   subject/body and Dev browser-client session validity to the reviewed source
   values.
3. Use `no-reply@recruiterreply.com` as the canonical Cognito sender for every
   private environment. Dev already matches; in the same or a separately
   approved identity change, reconcile Test from `noreply@recruiterreply.com`
   to the verified `no-reply@recruiterreply.com` identity.
4. Retain the Dev package checksum change in the audit manifest. It records the
   reviewed deployed OIDC bytes and does not publish code or alter AWS state.
5. Rerun the protected read-only audit after any approved identity change. A
   clean result requires exit `0`; exit `2` remains a drift report, not a clean
   reconciliation.

## Safety and rollback

No deletion, replacement, database migration, secret read, user change, or
production behavior is proposed. The Cognito pool deletion protections and
Terraform prerequisite checks remain unchanged. If the checksum metadata is
rejected during review, revert this manifest-only change; do not normalize the
live edge association or remove its protections as a workaround.
