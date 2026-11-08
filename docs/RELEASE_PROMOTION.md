# Release promotion controls (issue #237)

## Commands
- Dev: implement and merge an issue PR; the existing Build (Dev) workflow deploys the main SHA and automatically reconciles eligible `Dev-Completes` issues after deployment and smoke verification. The optional `dev-acceptance-verified` label triggers a retry for an already verified deployment.
- Test: GitHub Actions > Promote to Test > Run workflow. This resolves the latest successful Dev deployment SHA.
- Prod: GitHub Actions > Promote to Prod > Run workflow. This resolves the latest successful Test deployment SHA.
- Application rollback: GitHub Actions > Roll Back Production Application > Run workflow. Supply a prior successful Production SHA and type `ROLLBACK:<target_sha>` exactly. This restores application artifacts only; it does not run EF migrations or restore the database. The rollback records an explicit Production deployment status for the target SHA so the subsequent restore guard sees the actual deployed release. After validation, run the same workflow with the current release SHA to restore the forward release.
- From a terminal: `gh workflow run promote-test.yml --repo moojjoo/recruiterreply --ref main` and, after independent Test approval, `gh workflow run promote-prod.yml --repo moojjoo/recruiterreply --ref main`.

## Evidence
The Dev build records a versioned aggregate release manifest containing the source SHA, build run, backend image/digest, and frontend digest alongside the backend and frontend artifacts. The reusable promotion workflow requires and verifies that manifest before any environment mutation, then emits an environment manifest containing the deployed SHA, digests, environment, run URL, and success timestamp after smoke tests. GitHub deployment statuses remain the source of truth for selecting the previous environment's latest successful SHA. Environment-specific runtime config.js and robots.txt intentionally differ and are not included in the original frontend digest.

Dev completion is automated from the verified merged SHA, required checks, deployment, and smoke evidence. Test and Prod remain separate, explicit environment promotions and retain their GitHub environment approval gates.

## Safety limitations / follow-up work
- GitHub Actions artifacts currently have 90-day retention. A permanent immutable manifest and artifact store is required before treating long-term rollback and promotion as guaranteed.
- ECR image tags are mutable unless repository tag immutability is configured. For true immutable promotion, deploy the verified digest (not a mutable SHA tag), or enforce tag immutability.
- A successful deployment record can exist while a release manifest artifact is missing; promotion must eventually require digest matching against the source manifest.
- Environment promotions must detect an already-deployed SHA and avoid redundant deployment.
- Dev, Test, and Production reusable promotions serialize on one non-canceling shared-host lock; the expected SHA remains the fail-closed race guard.
- Database rollback needs a separately reviewed migration compatibility and restore procedure. Never automatically roll back a database.
- GitHub Actions tests and a real Dev deployment are required before claiming the feature complete.
- Production promotion performs database migrations; require an explicit separate approval before running it.
- Production application rollback requires a prior successful Production deployment, immutable artifacts, the Production environment approval, and exact SHA confirmation. It must never perform a database migration or database restore.
- Production promotion first performs a read-only migration-history comparison. Pending migrations require an exact `database_authorization` input matching `<production-sha>:sha256:<migration-script-digest>`; no pending migrations skip the database mutation path. Destructive SQL is rejected by the migration gate unless that exact authorization is present, and backups are named with the migration digest.

Do not close issue #237 until these gaps and its acceptance criteria are validated.
