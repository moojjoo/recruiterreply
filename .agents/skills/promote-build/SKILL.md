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

1. Determine which SHA to promote. Usually this is the current tip of `main`:
   `git rev-parse origin/main`. If the user names a specific commit or a past SHA,
   use that instead.
2. Confirm that SHA was actually built: check for a successful "Build (Dev)" run
   at that commit — `gh run list --workflow=build.yml --branch=main --limit=5`.
   If there's no successful build for it, say so and stop; don't guess.
3. To promote to test:
   `gh workflow run promote-test.yml --ref main -f sha=<sha>`
   (`--ref main` is required — that's the branch these workflow files live on).
4. Report back what's happening and where to watch it (`gh run watch` or the
   Actions tab). **Do not also run promote-prod.yml in the same turn** — prod
   promotion is a separate, deliberate action after the user has verified test.
5. Only once the user explicitly confirms test looks right ("looks good", "ship
   it", "promote to prod") do you run:
   `gh workflow run promote-prod.yml --ref main -f sha=<same sha>`
   Always state clearly that this deploys production, and wait for that
   confirmation in the same turn — the phrase "promote to test" alone does not
   imply "and then prod."

## Notes

- There's no PR, no branch merge, no new commit involved in promotion — the `sha`
  input is the entire mechanism. Promoting the same SHA to test twice, or to test
  then prod, re-runs the exact same artifacts; it does not rebuild anything.
- `promote.yml` refuses to run if the ECR image or the S3 frontend artifact for
  that SHA doesn't exist — that failure means the SHA was never built (or was
  built before this artifact-promotion pipeline existed).
- The `dev` branch still exists but is no longer used for anything in this flow.
  Feature/fix branches merge straight into `main`; don't route them through `dev`.
