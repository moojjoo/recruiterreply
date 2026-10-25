# RecruiterReply EC2 Docker image retention (Issues #385 and #505)

**Status: environment-aware post-health-check preview; deletion requires a manual workflow dispatch with an approved plan digest.**

The EC2 root disk reached 90% utilization with roughly 195 historical backend images. A manual cleanup restored approximately 21 GB free space. The policy retains the latest 10 successful Dev SHAs, 5 Test SHAs, and 4 Prod SHAs. Shared SHAs count once locally, and **all images referenced by any Docker container** (running or stopped) remain protected even when they are outside that history.

## Review commands on EC2

```bash
sudo python3 scripts/recruiterreply-image-prune.py --policy-file retention-policy.json
python3 -m unittest discover -s tests -p 'test_docker_image_prune.py'
df -h /
sudo docker system df
```

Preview is the default; the script does not delete images without `--apply`. Use the manually dispatched **EC2 Backend Image Retention** workflow to obtain a fresh preview. Apply requires both the exact confirmation phrase and the preview's 64-character `plan_digest`. The script refuses deletion if the current protected/candidate set no longer matches that approved digest.

The reusable Dev/Test/Prod promotion workflow resolves successful GitHub deployment histories, adds the in-flight immutable SHA, installs the reviewed script, and waits for the environment backend `/health` endpoint before releasing the deployment side of `/tmp/recruiterreply-docker-deploy.lock`. A separate SSM command then runs the 10/5/4 preview under that same host lock. Keeping the preview in its own command prevents earlier deployment output from consuming SSM's bounded output capture, so Actions logs reliably contain candidate/protected counts, the plan digest, root filesystem metrics, `docker system df`, and a JSON `SUMMARY`. The workflow fails if that preview summary is absent. The manual EC2 deployment helper uses the same lock. The previous broad `docker image prune -f` step remains removed.

## Safety invariants

1. Verify any new out-of-band EC2 deployment or rollback path acquires `/tmp/recruiterreply-docker-deploy.lock`; repository-managed EC2 paths now share it.
2. Resolve only full immutable SHAs whose latest GitHub deployment status is successful; include an in-flight promotion SHA in its environment history.
3. Review a fresh dry-run and pass its plan digest to the manual apply dispatch. Do not treat workflow-level concurrency as a substitute for the host lock.
4. Preserve and extend race, changed-tag, missing-image, multi-tag, Docker-error, stopped-container, and dry-run regression coverage.
5. Capture `df -h /` and `docker system df` before and after cleanup; alert when root utilization approaches 80%.

The script does not touch PostgreSQL images, volumes, containers, backups, or unrelated repositories. Docker may preserve layers shared by retained images. This **local EC2** retention policy is separate from AWS ECR lifecycle policies.
