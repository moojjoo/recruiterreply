# Protected Dev/Test API documentation (#719)

## Supported route and environments

- UI: `/api/swagger`
- OpenAPI JSON: `/api/swagger/v1/swagger.json`
- Environments: Development (Dev) and Staging (Test) only
- Configuration: `Swagger:Enabled=true` must be explicit
- Production: hard-disabled by source policy even if the flag is present

The route uses the existing HTTPS `/api/*` behavior. It does not add a port,
listener, ingress rule, firewall exception, IAM permission, or alternate API
origin. The default `/swagger`, `/openapi`, and `/api/openapi` route families
are rejected to prevent an unprotected alias.

## Security boundaries

Requests reach documentation only after `PrivateApiOriginAuthMiddleware` has
validated the edge-to-origin signature and the `Application` authentication
scheme has established an application user. A perimeter `rr_session` alone is
not an application session in BFF mode and cannot satisfy this requirement.

The UI points to `./v1/swagger.json`, keeping schema retrieval on the same
origin and protected route. All Swagger UI submit methods are disabled. This
does not modify `BffCsrfMiddleware`, controller authorization, fallback
authorization, or endpoint ownership checks.

Responses from the documentation guard use `Cache-Control: no-store`.
Disabled environments and aliases return 404; missing application
authentication returns 401; missing or invalid private-origin signatures are
rejected earlier with 403.

## Configuration

`infra/aws/docker-compose.multi-env.yml` opts in only the Dev and Test backend
services:

```text
Swagger__Enabled: "true"
```

The Production service is unchanged and the source environment check prevents
configuration-only activation there.

## Verification scope

Automated integration coverage exercises:

- flag-on/off behavior in Development and Staging;
- Production and unknown-environment hard-off behavior;
- UI HTML, relative schema configuration, JSON, and a static UI asset;
- missing and invalid origin signatures;
- anonymous, perimeter-only, and authenticated application requests;
- `/swagger`, `/openapi`, and `/api/openapi` aliases;
- representative authorization on `/api/sample`;
- disabled Swagger submit methods.

The representative endpoint check confirms that this pipeline change does not
remove normal fallback authorization. It is not evidence that every product
endpoint has completed a route-by-route authorization or ownership audit.
Existing API authorization, CSRF, and domain-specific tests remain the source
of evidence for those behaviors.

## Rollout and rollback

Use the existing immutable build and environment promotion workflows. Verify
Dev first, then use the separately owner-gated Test promotion. Record the
deployed SHA and backend digest. Production is outside this rollout.

Rollback uses the prior approved backend artifact/configuration. No migration
or data rollback is involved.
