# Issue #456 — Production Cognito API authentication architecture

**Status:** Architecture decision record for owner approval

**Scope:** Production target architecture and the Dev/Test-compatible migration
plan. This document does not provision AWS resources, change authentication
runtime behavior, or authorize a Terraform apply.

## Decisions

### 1. BFF sessions and OAuth token storage

The ASP.NET Core backend is the production BFF and the only component allowed
to exchange Cognito authorization codes or hold Cognito refresh/access tokens
for browser users. The browser receives only an opaque session identifier in a
`__Host-rr_session` cookie.

Use one DynamoDB session table per environment:

```text
recruiterreply-{environment}-bff-sessions
```

The table has:

- a randomly generated, high-entropy session identifier as the partition key;
- encrypted-at-rest session data, with a customer-managed KMS key per
  environment;
- encrypted OAuth access and refresh tokens stored only in the server-side
  record, never as claims or cookie values;
- user ID, Cognito subject, issuer, client ID, granted scopes, creation time,
  last-seen time, absolute expiry, idle expiry, and token rotation metadata;
- DynamoDB TTL as cleanup assistance, with application-side expiry checks on
  every request.

The application IAM role may access only its environment's table and KMS key.
Dev, Test, and Production use separate Cognito pools, clients, tables, keys,
and secrets. No session record is portable between environments.

The session cookie is `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, and has no
`Domain` attribute. The cookie contains no email, access token, refresh token,
tenant ID, or authorization decision. The BFF rotates the session identifier
after login and on refresh-token rotation. Logout deletes the server-side
record and expires the cookie.

The existing edge `rr_session` cookie is an environment gate for Dev/Test. It
is not the production BFF session format and must not be treated as an API
OAuth token.

### 2. Cognito clients, resource server, scopes, roles, and audiences

Each environment has its own Cognito user pool and resource server. The API
resource-server identifier is an environment-specific configuration value; it
must never be accepted from a request. The API validates the configured issuer
and resource-server audience for that environment.

The user-facing BFF client is a confidential server-side client using
Authorization Code + PKCE. It has no client secret in the browser and receives
only these user scopes:

```text
openid
email
profile
recruiterreply-api/read
recruiterreply-api/write
```

The API recognizes only the following custom scopes:

| Scope | Purpose |
| --- | --- |
| `recruiterreply-api/read` | Read the authenticated user's or authorized tenant's resources. |
| `recruiterreply-api/write` | Create or modify resources owned by the user or authorized tenant. |
| `recruiterreply-api/admin` | Explicit administrative operations; never implied by `write`. |
| `recruiterreply-api/internal` | Service-to-service calls only; never grant to browser users. |

The API accepts access tokens only. It rejects ID tokens (`token_use != access`)
and validates issuer, signature/JWKS key, lifetime, token use, client ID,
environment-specific audience/resource server, scopes, and replay-sensitive
claims where applicable. A valid signature alone is insufficient.

Cognito groups are mapped to coarse roles only:

```text
rr:user
rr:support
rr:admin
```

Roles grant capability ceilings; they do not grant ownership of another user's
records or bypass tenant membership checks. `rr:admin` is restricted to
explicitly audited administrative routes. Support access is time-bound and
requires an audit reason.

Machine clients are separate from the browser BFF client and are created per
environment:

| Client | Allowed scope | Intended use |
| --- | --- | --- |
| `recruiterreply-{env}-ci` | `recruiterreply-api/read` | Deployment health and private smoke checks. |
| `recruiterreply-{env}-worker` | The smallest required `read`/`write` subset | Approved background processing only. |
| `recruiterreply-{env}-ops` | `recruiterreply-api/admin` | Break-glass operations, disabled by default and audited. |

Machine credentials are stored in AWS Secrets Manager, rotated independently,
and are never shipped to frontend bundles. Signed webhooks remain authenticated
by their provider signature and replay protection; they do not receive a
general-purpose OAuth client.

### 3. Tenant and resource authorization

Authorization is deny-by-default and is enforced in the API service/repository
boundary, not by frontend route visibility or a user-supplied tenant ID.

The target data model adds:

- `Organizations` (the tenant/workspace);
- `OrganizationMembers` with user ID, organization ID, role, status, and audit
  timestamps;
- an organization ID on every tenant-owned resource;
- explicit owner IDs for resources that remain user-owned.

Existing users receive one personal organization during the additive migration.
Existing records are assigned to that organization only through a reviewed,
backed-up data migration. No record is deleted or silently shared across
organizations.

Every protected request follows this order:

1. authenticate the BFF session or validated access token;
2. require the endpoint's declared scope;
3. load the target resource and its organization from the database;
4. verify the caller is the resource owner or an active member of that
   organization with the required role;
5. write an audit event for administrative, support, cross-user, or
   cross-organization access.

The API never authorizes a resource solely from a client-provided user ID,
organization ID, Cognito group, email address, or unvalidated claim. Until the
organization tables and ownership backfill exist, endpoints requiring tenant
semantics remain disabled or are restricted to same-user ownership. There is
no fail-open interim tenant policy.

### 4. CSRF protection and session lifecycle

Because browser authentication uses cookies, all state-changing requests
(`POST`, `PUT`, `PATCH`, and `DELETE`) require both:

- a valid ASP.NET Core antiforgery token sent in `X-CSRF-TOKEN`; and
- an `Origin` (or, where unavailable, `Referer`) matching the exact configured
  application origin.

The BFF exposes a same-origin endpoint that issues the antiforgery token pair.
The antiforgery cookie is not an authentication credential; its readable half
may be accessed by the frontend solely to populate the request header. CORS
allows credentials only for exact configured origins and never uses `*`.

JSON content types are required for API mutation endpoints. Login initiation,
OAuth callback, logout, account recovery, and consent changes receive explicit
CSRF/replay treatment; OAuth `state`, PKCE, one-time callback consumption, and
the existing replay store protect the authorization-code exchange.

Session policy:

- 30-minute idle timeout;
- 8-hour absolute lifetime for a browser session;
- refresh-token rotation on refresh, with reuse detection revoking the session
  family;
- immediate server-side revocation on logout, password reset, account disable,
  or detected refresh-token reuse;
- DynamoDB TTL for eventual cleanup plus synchronous expiry checks;
- no silent session extension beyond the absolute lifetime.

Session identifiers, token-subject mappings, refresh failures, CSRF failures,
replay detections, and revocations are logged without token values or raw
cookies. Logs contain environment, user ID where available, client ID, reason,
and correlation ID.

### 5. Migration and retirement of custom JWT/localStorage authentication

Migration is staged and reversible until the final retirement gate:

1. **Inventory and contract:** add the route/authentication matrix and define
   BFF endpoints for login, callback, session, refresh, logout, and CSRF. Do
   not change the current token contract yet.
2. **BFF foundation:** deploy the per-environment session table, KMS/IAM
   controls, Cognito clients/resource server, validation, and negative tests.
3. **Frontend cutover:** replace bearer-token injection and `authToken` storage
   with same-origin credentialed requests. Store only non-sensitive display
   state locally; never store access or refresh tokens in localStorage,
   sessionStorage, or browser-readable cookies.
4. **Controlled compatibility window:** accept the legacy custom JWT only when
   an environment feature flag is explicitly enabled. Emit no new legacy JWTs
   for migrated login paths. Record usage metrics and reject legacy tokens on
   routes already migrated to BFF authorization.
5. **Reauthentication:** expire the compatibility window after the maximum
   legacy token lifetime plus a documented grace period. Users with legacy
   tokens sign in again through Cognito; no legacy token is exchanged for a
   Cognito refresh token.
6. **Retirement:** remove legacy JWT issuance, bearer-token parsing, signing
   secrets, frontend localStorage cleanup paths, and the compatibility flag in
   a separately reviewed change. Revoke/rotate the old signing key after all
   environments confirm zero legacy traffic.

Rollback during steps 2–5 means disabling the affected BFF feature flag while
the legacy verifier remains constrained, observable, and time-limited. It does
not mean restoring browser storage of OAuth tokens or accepting Cognito ID
tokens as API credentials. After step 6, rollback requires a new reviewed
authentication release and explicit owner approval.

## Required evidence before implementation approval

- route-by-route anonymous/authenticated/scope/ownership matrix;
- additive organization and ownership migration plan, including backup and
  restore evidence;
- Cognito issuer, audience, token-use, scope, role, and environment-isolation
  tests;
- BFF session, refresh rotation, logout, CSRF, replay, and revocation tests;
- negative tests for forged, expired, wrong-environment, wrong-scope,
  cross-user, cross-tenant, CSRF, and refresh-reuse requests;
- Dev validation followed by Test validation, monitoring thresholds, and a
  documented rollback decision.

No Terraform apply, database migration, secret change, or Production
promotion is authorized by this document.
