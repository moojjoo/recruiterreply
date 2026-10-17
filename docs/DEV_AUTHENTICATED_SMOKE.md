# Authenticated Dev smoke checks (#436)

Dev deployment remains disabled unless the protected `DEV_AUTHENTICATED_SMOKE_READY` environment variable is `true`. When enabled, the reusable promotion workflow runs two independent checks:

1. The anonymous boundary probe verifies that Dev redirects every tested route to the local Cognito login endpoint, with `no-store` and `noindex` protections.
2. The authenticated probe uses a short-lived `DEV_SMOKE_SESSION_COOKIE` and `DEV_SMOKE_API_TOKEN` from the protected Dev GitHub environment. It verifies the prerendered homepage, referenced assets, `/dashboard`, and the configured API health endpoint.

Credentials are never printed, persisted as artifacts, included in URLs, or included in assertion messages. Configure them only through the protected Dev environment, rotate them before expiry, and revoke them before disabling the smoke identity. The API token must be least-privilege and limited to the approved health/readiness path.

This change does not provision Cognito, update Terraform, enable CloudFront, populate secrets, or promote Test/Production. If either credential is missing or invalid, deployment verification fails closed and issue reconciliation does not run.
