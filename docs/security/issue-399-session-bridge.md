# Issue #399 — Cognito edge session bridge

This slice connects the reviewed Dev/Test edge session to ASP.NET Core without
putting Cognito tokens in browser storage.

## Request flow

```text
Browser → Cognito + MFA → rr_session (Secure, HttpOnly, 15 minutes)
        → same-origin /api request → EdgeSession authentication scheme
        → existing application authorization and resource checks
```

The API validates the sealed `rr_session` cookie, checks its environment issuer
and client ID, and resolves the identity by `issuer|sub`. A new user is created
only when the session contains a verified email. An existing email account is
never silently linked; explicit account linking is required.

## Required deployed configuration

Each environment must provide these values through AWS Secrets Manager or the
approved equivalent. The edge and API must receive the same session secret:

```text
EdgeSession:Secret=<at least 32 bytes, environment-specific>
EdgeSession:Issuer=https://cognito-idp.us-east-1.amazonaws.com/<pool-id>
EdgeSession:ClientId=<environment-specific Cognito app client ID>
```

Missing configuration fails closed. Dev and Test secrets, issuers, client IDs,
and user pools must not be reused across environments.

## Remaining integration

The browser API must be routed through the same-origin `/api/*` behavior so the
host-only `rr_session` cookie reaches the private API path. That wiring belongs
to issue #398. Direct `api-dev` and `api-test` access remains blocked.
