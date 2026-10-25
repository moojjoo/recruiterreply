---
name: promote-build
description: Promote a commit SHA already built by the Build (Dev) workflow to test or prod, without a rebuild. Use when the user says "promote to test", "promote to prod", "ship this SHA", "deploy the build that's on dev", or runs /promote-build.
---

# promote-build

This repo is trunk-based: `main` is the only long-lived branch. Feature/fix work
happens on short-lived branches, merged into `main` via PR. Every merge to `main`
runs `.github/workflows/build.yml`, which builds the backend image (tagged
`recruiterreply-backend:<sha>` in ECR) and the frontend bundle (uploaded to
`s3://recruiterreply-build-artifacts-<account-id>/frontend/<sha>/`) exactly once,
then auto-deploys that same SHA to the `dev` AWS environment.

Promoting to test or prod means pointing the *same* image and bundle at another
environment — never rebuilding. That's done via `.github/workflows/promote.yml`
(a reusable workflow), triggered through `promote-test.yml` / `promote-prod.yml`.

## Steps

1. Refresh `origin/main`, then inspect the latest successful deployment in the
   source environment. Test resolves from `dev`; production resolves from `test`.
   Use the latest status for each deployment as authoritative, exactly as the
   workflow does. Ignore a deployment whose latest status is not `success`.
2. Record the expected 40-character deployment SHA. Confirm a completed,
   successful "Build (Dev)" run exists for that exact SHA and report both the SHA
   and build URL. If the source deployment or matching build is missing, stop;
   do not dispatch or guess.
3. To promote to test, run:
   `gh workflow run promote-test.yml --ref main -f expected_sha=<expected-sha>`
   The required guard input must be the SHA verified in step 2. The workflow
   resolves the latest successful Dev deployment itself and fails before promotion
   if it differs from `expected_sha`. `--ref main` selects the branch containing
   the workflow; it does not select the promoted artifact SHA.
4. Retrieve the new promotion run and verify its source resolution before treating
   it as successful. After completion, confirm the new successful `test`
   deployment records the expected SHA. A different SHA is a release race: report
   it clearly and do not claim the expected release was promoted.
5. Report the run URL and final result. **Do not also run promote-prod.yml in the
   same turn** — production is a separate, deliberate action after the user has
   verified Test.
6. Only once the user explicitly confirms Test looks right ("looks good", "ship
   it", "promote to prod") repeat steps 1 and 2 with `test` as the source, state
   clearly that the next action deploys Production, and run:
   `gh workflow run promote-prod.yml --ref main -f expected_sha=<expected-sha>`
   Approve the protected `prod` environment only when the authenticated owner can
   approve and the same explicit Production authorization covers the pending run.
   After completion, confirm the new successful `prod` deployment records the
   expected Test SHA.

## Notes

- There is no PR, branch merge, or new commit involved in promotion. The required
  `expected_sha` input is a fail-closed race guard, not an override: the wrapper
  workflow selects the latest successful deployment from the preceding environment
  and proceeds only when its SHA exactly matches the approved expectation.
- Promoting the same SHA to Test twice, or to Test then Production, reuses the
  exact same artifacts; it does not rebuild anything.
- `promote.yml` refuses to run if the ECR image or the S3 frontend artifact for
  that SHA doesn't exist — that failure means the SHA was never built (or was
  built before this artifact-promotion pipeline existed).
- The `dev` branch still exists but is no longer used for anything in this flow.
  Feature/fix branches merge straight into `main`; don't route them through `dev`.
