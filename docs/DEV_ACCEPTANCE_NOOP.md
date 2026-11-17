# Dev acceptance after an idempotent promotion (#694)

A successful no-op promotion is not a new acceptance pass.

A second build of the same source SHA can produce a different image digest.
When promotion finds an existing deployed manifest for that SHA, it skips
deployment. Its newly built digest is therefore not necessarily the running
backend. Dispatching validation with that digest correctly fails exact-release
manifest verification but creates misleading duplicate failed runs.

The automatic Dev acceptance dispatch now requires an explicit non-no-op
promotion result. Fresh and explicitly forced deployments still dispatch after
normal deployment verification. Dev no-ops publish a not-run summary and do not
create or overwrite an acceptance artifact. Existing passed or failed evidence
retains its original SHA/digest/test revision; a no-op does not convert it to a
pass. Test dispatch behavior and Production are unchanged by this Dev-only fix.

## Deliberate revalidation

Use the existing Authenticated Dev/Test Playwright manual workflow with:
1. Environment: Dev.
2. Deployed SHA and backend digest from the actual successful Dev deployment
   manifest, not from a later build of the same source.
3. An explicitly selected immutable test revision.

The workflow still checks the exact manifest, shared deployment lease, destination
allowlist and CI identity. Do not edit manifests to fit a rebuilt digest or claim
a passing result for an image that was never deployed. Test/Production promotion
and security-setting changes retain their separate approvals.

## Verified incident

- PR #703 merged as 97fbaeb26e83d2fc9d7299f4aa415107adbe0657.
- Deployment run 43992551890 deployed backend digest beginning 14ae8f7e.
- Authenticated run 43993336845 passed all five tests for that exact release.
- Duplicate build run 43992555545 produced digest beginning 65f2e107 but correctly
  skipped deployment as a no-op.
- Its validation run 43994056781 was blocked before browser tests because that
  rebuilt digest did not match the actual deployed manifest.

These historical observations do not certify any later release.
