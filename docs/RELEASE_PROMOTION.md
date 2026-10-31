# Release promotion controls (issue #237)

## Commands
- Dev: implement and merge an issue PR; the existing Build (Dev) workflow deploys the main SHA and automatically reconciles eligible `Dev-Completes` issues after deployment and smoke verification. The optional `dev-acceptance-verified` label triggers a retry for an already verified deployment.
- Test: GitHub Actions > Promote to Test > Run workflow. This resolves the latest successful Dev deployment SHA.
- Prod: GitHub Actions > Promote to Prod > Run workflow. This resolves the latest successful Test deployment SHA.
- From a terminal: `gh workflow run promote-test.yml --repo moojjoo/recruiterreply --ref main` and, after independent Test approval, `gh workflow run promote-prod.yml --repo moojjoo/recruiterreply --ref main`.

## Evidence
The reusable promotion workflow checks that the ECR SHA tag exists, resolves the SHA's successful Build (Dev) run, downloads its frontend artifact, records the ECR image digest and a deterministic digest of downloaded frontend files, and emits a release-manifest artifact containing SHA, digests, environment, run URL, and success timestamp after smoke tests. GitHub deployment statuses remain the source of truth for selecting the previous environment's latest successful SHA. Environment-specific runtime config.js and robots.txt intentionally differ and are not included in the original frontend digest.

Dev completion is automated from the verified merged SHA, required checks, deployment, and smoke evidence. Test and Prod remain separate, explicit environment promotions and retain their GitHub environment approval gates.

## Safety limitations / follow-up work
- GitHub Actions artifacts currently have 90-day retention. A permanent immutable manifest and artifact store is required before treating long-term rollback and promotion as guaranteed.
- ECR image tags are mutable unless repository tag immutability is configured. For true immutable promotion, deploy the verified digest (not a mutable SHA tag), or enforce tag immutability.
- A successful deployment record can exist while a release manifest artifact is missing; promotion must eventually require digest matching against the source manifest.
- Environment promotions must detect an already-deployed SHA and avoid redundant deployment.
- Cross-environment concurrency and race handling require stronger locking than separate target-environment job groups.
- Database rollback needs a separately reviewed migration compatibility and restore procedure. Never automatically roll back a database.
- GitHub Actions tests and a real Dev deployment are required before claiming the feature complete.
- Production promotion performs database migrations; require an explicit separate approval before running it.

Do not close issue #237 until these gaps and its acceptance criteria are validated.
