# Issue #356 Dev-only rollout

This runbook separates the Dev rollout from Test. It does not enable either
CloudFront distribution, apply Terraform, populate secrets, invite users, or
authorize Test/Production changes.

## Verified live prerequisites (2026-10-13)

- SES domain identity `recruiterreply.com` is verified and sending-enabled in
  `us-east-1`.
- No RecruiterReply Cognito user pool, private-edge Lambda, signing-key secret,
  or OAuth replay table exists yet.
- Dev and Test CloudFront distributions are disabled.

## Phase-one Dev plan

Use the existing global-root variables with both environment selectors set to
`["dev"]`. Supply the verified SES identity and a unique Dev Cognito domain
prefix through an uncommitted variable file or approved deployment system.

The reviewed plan produced exactly **5 additions, 0 changes, 0 destroys**:

1. Dev Cognito user pool with mandatory email MFA and deletion protection.
2. Dev public browser client using authorization code flow and PKCE.
3. Dev Cognito hosted domain.
4. Dev Secrets Manager signing-key container (no secret value in Terraform).
5. Dev on-demand DynamoDB OAuth replay table with TTL.

The phase-one plan creates no Lambda function, CloudFront association, user,
secret value, Test resource, or Production change. A plan file is ephemeral and
must never be committed.

## Remaining gated phases

1. Obtain explicit Terraform-apply approval for the reviewed phase-one plan.
2. Populate the Dev signing-key secret out of band using cryptographically random
   independent keys; never place values in Terraform state, logs, or source.
3. Invite the approved Dev tester and verify password plus native Cognito email
   MFA, recovery, throttling, and desktop/mobile email rendering.
4. Generate and inspect the immutable Dev Lambda ZIP, record its SHA-256, and
   review the function-only Terraform plan.
5. Apply the reviewed Dev function plan, then separately review and apply the
   disabled-distribution association plan.
6. Verify denial/noindex behavior through the Dev alias and direct distribution
   hostname before separately approving CloudFront enablement.
7. Set `DEV_AUTHENTICATED_SMOKE_READY=true` only after authenticated CI smoke
   credentials and negative-path checks are operational.

Any failed prerequisite leaves Dev disabled. Test requires a separate owner
promotion command and its own plans, secrets, invited users, and live tests.

## Rollback

Before Dev is enabled, rollback is to leave the distribution disabled and remove
or detach any unverified association in a separately reviewed plan. After an
enablement failure, disable Dev first, invalidate CloudFront caches, preserve logs
and state for diagnosis, and rotate the signing keys if compromise is suspected.
Deletion-protected Cognito and protected Secrets Manager resources must not be
force-destroyed as part of an emergency rollback.
