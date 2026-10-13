# Issue #357: API perimeter and authorization audit (partial)

## Confirmed code findings (not live AWS verification)
- `backend/Program.cs` uses JWT bearer authentication and a frontend CORS policy. CORS does not block non-browser API clients.
- The unauthenticated `/health/db` and `/api/health/db` endpoints returned counts of user and message records.
- The unauthenticated `/health/gmail` and `/api/health/gmail` endpoints returned Gmail connection counts and configuration status.
- The unauthenticated `/health/crud` and `/api/health/crud` endpoints executed database writes inside a rolled-back transaction.
- Swagger/OpenAPI is enabled in Development; hosted Dev also runs as Development.
- `infra/aws/terraform/modules/security/main.tf` permits public HTTP/HTTPS ingress from `public_ingress_cidrs`. **Live overrides and deployed security groups are not verified.**

## First mitigation in this PR
Require JWT authentication for all deep health probes (db, apis, gmail, crud), including their `/api` aliases. Remove record counts from DB/Gmail diagnostics. Keep lightweight `/`, `/health` and `/api/health` anonymous for load balancer / smoke checks. Do not change network access or production infrastructure in this PR.

## Remaining blocking work before closing #357
- Inventory live DNS, CloudFront, EC2 IPs, security groups, nginx, Docker port publishing, IAM, database exposure for each environment using **read-only** AWS evidence.
- Audit all controllers/actions and ownership/tenant authorization; establish route-by-route public/auth/admin/internal matrix; fix IDOR and any missing authorization.
- Restrict hosted Dev Swagger, and ensure diagnostics are internal-only rather than merely JWT-authenticated where appropriate.
- Restrict direct-origin and alternate-port bypass. Dev/Test require an independent API access control, coordinated with incomplete Cognito frontend gateway #356.
- Add integration tests for anonymous/authorized probes, cross-account isolation, forged webhooks, rate limiting, and origin bypass.
- Validate production login/signup/reset/Stripe webhooks, Dev and Test end-to-end; review Terraform plans, rollback, and explicit approvals before promotion.
- Do not assume merged code is deployed; no live infrastructure change is authorized here.

## Rollout warning
Existing anonymous consumers of deep diagnostics will receive HTTP 401. Confirm deployment health checks use only the lightweight public health endpoints before approving a rollout.
