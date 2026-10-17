# Private Test rollout and verification (#421, #424)

Test uses its own Cognito pool, mandatory email MFA, signing keys, replay table,
versioned Lambda@Edge function and CloudFront distribution. The shared EC2 host
continues to run separate Dev, Test and Production containers and databases.

## Promotion verification

`promote.yml` verifies Test frontend files with authenticated S3 reads against
the promoted artifact, including the prerendered homepage, asset bytes, runtime
`/api` configuration and crawler exclusion. Anonymous HTTPS probes must redirect
pages, config, assets, deep links and `/api/health` to the local login endpoint.
Login must redirect to the approved Test Cognito client and callback using code
flow and PKCE. Forged cookies cannot bypass the gate. The distribution hostname
and direct API origin must return 403. Missing configuration, public content,
outages, incorrect identity and artifact mismatches fail promotion.

Configure the public `TEST_COGNITO_DOMAIN`, `TEST_COGNITO_CLIENT_ID`, and
`TEST_CLOUDFRONT_DOMAIN` variables
in the GitHub `test` environment. Existing Dev verification and Production
public-content/SEO checks retain their behavior.

Run local negative tests:

```bash
node --test .github/scripts/tests/private-test-smoke.test.cjs .github/scripts/tests/private-dev-smoke.test.cjs
```

Boundary-only verification uses the Test identity variables:

```bash
node .github/scripts/private-test-smoke.cjs --boundary-only
```

## Activation order

1. Capture private rollback snapshots and review a Test-only Terraform plan.
   Preserve Dev and Production inputs and reject plans that change either.
2. Create Test identity/runtime resources and a versioned edge function. Attach
   its gate while the distribution remains disabled.
3. Configure the matching `apiOriginSigningKey` in the existing Test backend
   Secrets Manager JSON without changing other settings or logging key values.
4. Enable Test with the authenticated, uncached `/api/*` behavior and wait for
   CloudFront propagation. Use AWS's exact lowercase managed CachingDisabled ID.
5. Promote the latest successful Dev release through `promote-test.yml`. The
   workflow selects that immutable SHA; do not pass an unsupported SHA input.
   Keep the existing nginx Test origin lockdown until the new backend is healthy
   and proves that unsigned and forged origin requests return 403.
6. Remove only the Test HTTPS server's unconditional nginx denial after the
   backend origin guard is active. Validate nginx before reload and immediately
   recheck direct-origin denial. Retain the HTTP origin denial and other hosts.
7. Verify the invited tester's real password change, email MFA, deep-link access,
   same-origin application API calls and logout. Automated boundary/origin
   checks do not establish completion of that browser flow or application-level
   cross-user authorization. Record remaining human validation explicitly.

No database migration is introduced by this rollout. Before promotion, inspect
any pending migrations because Test's existing startup configuration enables
automatic migration; destructive migrations require separate approval.

## Rollback and cost

Disable the Test distribution first if any perimeter or origin check fails.
Restore its captured configuration and the prior Test backend image through the
reviewed release process. Restore the Test nginx lockdown when needed. Preserve
Cognito users, signing keys, replay state and databases; do not destroy or reset
them. Restore a prior secret version only if required and after reviewing key
consistency with the deployed edge function. Dev and Production stay untouched.

Test uses the existing host, with no new EC2 instance. Incremental costs include
Cognito Essentials/email MFA, SES deliveries, Secrets Manager, DynamoDB replay
operations, Lambda@Edge requests and CloudFront usage/plan charges. Verify actual
billing configuration and usage in AWS; no numeric cost estimate is assumed.
