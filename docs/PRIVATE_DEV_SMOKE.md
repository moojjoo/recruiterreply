# Private Dev deployment verification

Issue #417 updates Dev verification for the Cognito edge gate introduced under #356.

The deployment workflow verifies every uploaded frontend file against the configured artifact through authenticated AWS S3 reads. It checks the prerendered homepage, referenced assets, resolved API configuration and crawler exclusion before proceeding to backend deployment. This verifies origin content integrity; it does not prove a signed-in browser can render the application or complete MFA.

Anonymous HTTPS probes use manual redirects. Homepage, config, real assets, deep links and SEO files must return the local authentication redirect with no-store and noindex. The login endpoint must redirect to the exact approved Dev Cognito domain/client using Authorization Code + PKCE and the Dev callback. Unexpected public content, outages and arbitrary redirects fail verification. Probes do not follow Cognito redirects, preserve cookies or log OAuth parameters.

Repository variables `DEV_COGNITO_DOMAIN` (hostname without scheme) and `DEV_COGNITO_CLIENT_ID` hold public identity configuration, confirmed against the existing Dev Cognito pool. They must change only with reviewed identity configuration changes; missing values fail verification. The existing Dev environment bucket and AWS credentials supply authenticated origin reads. No browser tokens or new secrets are required.

Run isolated negative tests with:

```bash
node --test .github/scripts/tests/private-dev-smoke.test.cjs
```

Run live read-only boundary verification with the two identity variables configured:

```bash
node .github/scripts/private-dev-smoke.cjs --boundary-only
```

The full deployment check also requires `S3_FRONTEND_BUCKET`, `API_BASE_URL`, AWS read access and the environment-configured `promoted-dist` directory. Test and Production retain their existing public-content checks. No distribution, identity pool, database or workflow readiness gate is enabled by this change.
