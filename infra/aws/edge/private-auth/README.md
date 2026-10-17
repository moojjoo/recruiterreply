# Issue #356 — CloudFront Cognito Authentication Gateway

## Status: Dev active behind the private gate; Test remains disabled

This directory contains the authentication gateway for the Dev and Test
CloudFront distributions. Dev is active behind the reviewed gate. Test remains
disabled pending a separately authorized rollout and validation.

Production must remain unaffected.

## Implemented

- Fail-closed Lambda@Edge viewer-request handler
- Dev/Test CloudFront distribution and hostname checks
- RS256 Cognito ID-token signature verification
- Issuer, audience, token-use and expiration validation
- Email verification and subject validation
- Trusted Cognito JWKS retrieval with timeout and caching
- JWKS response-size and failure protections
- Rejection of duplicate and malformed session cookies
- Removal of authentication cookies before S3 origin requests
- Independent Cognito identity approval checks
- PKCE S256 verifier and challenge generation
- Cryptographically random OAuth state and nonce generation
- Signed OAuth transaction cookies
- Authorization-code exchange with PKCE verifier
- OAuth state and ID-token nonce verification
- HMAC-signed 15-minute application sessions
- Atomic DynamoDB replay claims with TTL metadata
- Secrets Manager signing-key retrieval with bounded in-memory caching
- Validated deployment composition for immutable Dev/Test runtime configuration
- Explicit AWS SDK v3 runtime dependency manifest for deployment packaging
- Locked, production-only package staging with one environment per artifact
- Default-off Terraform modules for protected runtime state and versioned functions
- Separate default-off CloudFront association gate that leaves Dev/Test disabled
- Login, callback, logout, session validation and SPA rewriting in one
  viewer-request router
- Origin-response noindex enforcement compatible with the viewer-request gate
- Automated positive and negative security tests
- Branded, mobile-friendly Cognito MFA email with a prominent selectable code
  and no misleading in-email clipboard control

## Not yet implemented

- Reviewed, immutable Test Cognito identity configuration
- Token refresh and revocation handling
- Complete Test MFA end-to-end testing
- Reviewed Test package ZIP generation and hash approval
- Test Terraform plan review, apply approval and CloudFront rollout
- Live Test SPA routing compatibility verification
- Live Test negative-path and integration testing

## Architecture decisions pending Terraform integration

- The existing ASP.NET Core `AuthController` remains the product authentication
  controller. The private-site Cognito callback stays in the edge gateway so site
  access does not depend on backend availability and does not expose the product
  API JWT flow to the gateway.
- Dev and Test use separate Cognito identities, signing-key secrets and replay
  stores. Production is not a supported gateway environment.
- Signing keys are retrieved from separate `us-east-1` Secrets Manager secrets.
  Only non-secret resource identifiers may be compiled into an immutable edge
  function version. Lambda@Edge environment variables and layers are not used.
- AWS SDK v3 DynamoDB and Secrets Manager clients must be packaged in the Lambda
  deployment ZIP. No code path may assume that the runtime bundles those clients.
- The execution role must grant only `secretsmanager:GetSecretValue` for the exact
  environment secret and `dynamodb:PutItem` for the exact environment replay table.
- SPA rewriting occurs after successful session validation in the Lambda@Edge
  viewer-request handler. The separate Dev viewer-request CloudFront Function must
  not remain associated when the edge gateway is associated. The Dev/Test
  viewer-response noindex functions must also be removed because CloudFront does
  not allow CloudFront Functions on viewer events alongside a Lambda@Edge
  viewer-request association; associate the gateway version on origin-response
  to add `X-Robots-Tag` instead.
- Protected Dev/Test distributions should not translate S3 403/404 responses into
  HTTP 200. Once request rewriting is handled by the authenticated edge function,
  those mappings can mask origin and authorization failures. Production mappings
  are out of scope and remain unchanged.
- Terraform must keep Dev/Test distributions disabled until the versioned function,
  IAM policy, Secrets Manager resources, replay tables and CloudFront associations
  have been reviewed together. A successful plan does not authorize apply or enablement.

## Security restrictions

- Default Lambda@Edge handler remains fail-closed.
- Test remains disabled. Dev may be enabled only when its explicit release gate
  and the private edge association gate are both true.
- No AWS deployment or Terraform apply is authorized.
- No Production configuration changes are authorized.
- Never package test private keys into Lambda@Edge.
- Never log OAuth codes, tokens, PKCE verifiers or session secrets.
- Never forward authentication cookies to S3.
- Never place signing keys in Terraform source, state inputs, Lambda code, or
  Lambda environment variables.
- API isolation is separately tracked under issue #357.

Passing tests do not imply that the gateway is ready for deployment.

## Verification email behavior

Cognito's native email MFA template uses HTML with inline styles and the required
`{####}` placeholder. The six-digit code is large and selectable on desktop and
mobile. The email intentionally contains no Copy button: Gmail, Outlook, and most
other clients block the JavaScript clipboard API, so such a button would be
misleading. The message remains understandable when a client strips its styling.
The Cognito authentication session and the email text both use a 10-minute
validity window.

## Package staging

`package-stage.cjs` creates a new staging directory containing only runtime
modules, a generated handler entry point, one validated Dev or Test
configuration, and dependencies installed from `package-lock.json`.

```bash
node package-stage.cjs --config /secure/path/dev-config.json --output /tmp/recruiterreply-edge-dev
```

The configuration must contain exactly one approved distribution and only the
non-secret identifiers required by `deployment-handler.cjs`. The tool rejects
Production, multiple environments, extra fields (including signing-key values),
and existing output directories. Staging does not create or publish a Lambda
version and does not authorize Terraform apply or CloudFront association.

## Terraform phases

Terraform separates the rollout so exact non-secret resource identifiers can be
compiled into reviewed immutable packages:

1. `enable_private_edge_runtime_state` may provision protected Dev/Test Secrets
   Manager containers and DynamoDB replay tables in `us-east-1`. It does not put
   signing values into Terraform state, create Lambda, associate CloudFront, or
   enable a distribution. The replay tables use on-demand billing, TTL cleanup,
   and AWS-managed encryption. They deliberately omit point-in-time recovery and
   deletion protection because they contain only disposable, short-lived replay
   claims rather than application or audit data.
2. Populate each secret's `AWSCURRENT` value out of band, stage one package per
   environment using the exact secret ARN, replay-table name, and Cognito identity,
   then review the package contents and hashes.
3. A reviewed root integration creates versioned Lambda@Edge functions from
   those packages and associates viewer-request plus origin-response events.
   Each environment remains disabled until its live negative and MFA tests are
   approved. Dev has an additional explicit release gate; Test has no enablement
   path in this change.

Set `private_environment_identity_environments` and `private_edge_environments`
to `["dev"]` for a Dev-only rollout. This prevents a Dev authorization from
implicitly provisioning or associating Test resources. The defaults remain
`["dev", "test"]` for an explicitly approved combined rollout.

`enable_private_edge_associations` is a separate third gate. It replaces the
incompatible Dev SPA viewer-request and Dev/Test noindex viewer-response
CloudFront Function associations with the versioned Lambda on viewer-request
and origin-response. It also removes Dev/Test 403/404-to-200 mappings while
leaving Production unchanged. Dev additionally requires
`enable_private_dev_distribution = true`; Test remains disabled regardless.

## Search-indexing release gate

Dev and Test must not be discoverable through search engines. Before either
distribution can be re-enabled:

- invalidate all existing CloudFront cache entries after associating the
  viewer-request and origin-response Lambda version;
- verify unauthenticated requests cannot retrieve `/`, assets, SPA routes, SEO
  pages, `robots.txt`, or `sitemap.xml` through both the environment alias and
  direct CloudFront hostname;
- verify every denial, login redirect, callback failure, authenticated origin
  response, and origin error includes `X-Robots-Tag: noindex, nofollow`;
- verify the deployed Dev/Test `robots.txt` contains `User-agent: *` and
  `Disallow: /` while Production remains indexable;
- search for historically indexed Dev/Test URLs and submit removal requests
  through the relevant webmaster tools before reopening access; noindex does
  not itself immediately remove an already indexed URL.

Any missing control blocks re-enablement. Production SEO remains out of scope
and must not inherit these restrictions.

## Cost controls

No resource in this design is created while the Terraform feature flags remain
disabled. If approved and deployed, the only predictable fixed addition is two
Secrets Manager secrets (one for Dev and one for Test). Lambda@Edge, DynamoDB,
SES, and Cognito are usage-priced; at a small invited-tester workload their
incremental usage should be minimal. DynamoDB has no provisioned read or write
capacity, stores one small item per OAuth callback, and removes expired items by
TTL. Review an AWS cost estimate with the Terraform plan before any apply.
