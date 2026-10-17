# Authenticated Dev smoke checks (#436)

Dev deployment remains disabled unless the protected `DEV_AUTHENTICATED_SMOKE_READY` environment variable is `true`. When enabled, the reusable promotion workflow runs two independent checks:

1. The anonymous boundary probe verifies that Dev redirects every tested route to the local Cognito login endpoint, with `no-store` and `noindex` protections.
2. The authenticated probe requests a short-lived GitHub Actions OIDC token at runtime. The token is sent to the Dev edge as a one-request CI identity and to `/api/health/ci` as a bearer token. It verifies the prerendered homepage, referenced assets, `/dashboard`, and the OIDC-protected API health endpoint.

The edge and API validate the GitHub OIDC issuer, audience, repository, workflow reference, Dev environment claim, signature and expiry. The token is never printed, persisted as an artifact, included in a URL, forwarded to S3, or included in assertion messages. No long-lived smoke cookie or API JWT is stored in GitHub.

This change does not provision Cognito, apply Terraform, enable CloudFront, populate application secrets, or promote Test/Production. If the OIDC token is missing or invalid, deployment verification fails closed and issue reconciliation does not run. The Dev backend enables the dedicated OIDC policy only for the Dev compose service; Test and Production remain unchanged.
