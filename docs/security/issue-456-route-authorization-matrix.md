# Issue #456 — API route authorization matrix

This is the initial route inventory for the global authorization fallback. The
API requires an authenticated principal by default. Anonymous access must be
explicitly declared with `[AllowAnonymous]` or `.AllowAnonymous()` and must
remain listed here.

## Public routes

| Route | Method | Reason | Abuse/control boundary |
| --- | --- | --- | --- |
| `/` | GET | Liveness/service identity for routing checks. | No customer data; response is static. |
| `/health` | GET | Public load-balancer health check. | Static response only. |
| `/api/health` | GET | Public load-balancer health check through the API prefix. | Static response only. |
| `/api/auth/register` | POST | Legacy registration during the migration window. | Input validation and duplicate checks; replace with BFF registration before legacy retirement. |
| `/api/auth/login` | POST | Legacy login during the migration window. | Password validation and rate limiting must be added before production cutover. |
| `/api/auth/google/start` | GET | Starts the legacy Google authorization flow. | Redirect URL is server-generated. |
| `/api/auth/google/callback` | GET | Completes the legacy Google authorization flow. | OAuth provider callback; replace with the BFF callback. |
| `/api/auth/password-recovery/request` | POST | Starts account recovery. | Neutral response and password-recovery rate limit. |
| `/api/auth/password-recovery/complete` | POST | Completes account recovery. | One-time credential, expiry, attempt limit, and password validation. |
| `/api/billing/webhook` | POST | Stripe server-to-server webhook. | Stripe signature verification and replay/provider handling; not browser authentication. When private API origin signing is enabled for Dev/Test, this exact route bypasses the edge-origin header because Stripe cannot supply it; the application Stripe signature check remains mandatory. |
| `/api/gmail/callback` | GET | Gmail provider callback. | OAuth state/token validation in the Gmail service. |
| `/api/consent-events` | POST | Consent audit event from the public frontend. | Allowed-origin check and consent-audit rate limit. |

The legacy authentication routes above are temporary compatibility routes. They
must not issue or accept browser-stored tokens after the BFF cutover. Their
continued anonymous status requires the migration feature flag and monitoring
defined in the production architecture decision record.

## Authenticated routes

All other controllers and minimal API endpoints require authentication through
the configured application scheme. This includes:

- `/api/auth/me`;
- user, message, analysis, reply, comparison, opportunity, billing, career
  profile, Gmail, and recruiter-inbox APIs;
- `/health/db`, `/health/apis`, `/health/gmail`, and `/health/crud`, including
  their `/api/health/*` aliases.

Authenticated routes must additionally enforce the endpoint scope and
database-backed resource ownership or organization membership once the BFF
authorization policy is enabled. `[Authorize]` proves identity only; it does
not grant cross-user or cross-tenant access.

## Review rule

Any new endpoint that uses `[AllowAnonymous]` or `.AllowAnonymous()` must add a
row to this file in the same change, including its abuse boundary and removal
or migration condition. Anonymous routes must never return access or refresh
tokens to the browser.
