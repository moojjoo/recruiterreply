# ERROR_001 Troubleshooting Plan

## Objective
Fix GitHub Actions EC2 deploy step failing with exit code 1 during remote backend rollout.

## Steps

1. Locate the exact failing step in deployment workflows.
2. Identify commands inside the remote SSH script that can fail under `set -euo pipefail`.
3. Remove the remote dependency on EC2-local AWS credentials for ECR login.
4. Add minimum preflight checks to return explicit failure reasons.
5. Apply equivalent fix to dev/test/prod workflows.
6. Validate edited workflow blocks for argument ordering and shell correctness.
7. Re-run CI and confirm deploy step reaches `docker compose pull/up`.

## Root Cause Hypothesis
The remote script ran `aws ecr get-login-password` on EC2. If EC2 lacks AWS credentials (no instance profile or missing local credentials), command exits non-zero and the whole step fails with exit code 1.

## Required Fix
Generate ECR password on GitHub runner (where AWS creds are already configured) and pass it to EC2 over SSH stdin/arg list for `docker login`.
