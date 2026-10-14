# RecruiterReply EC2 Docker image retention (Issue #385)

**Status: post-health-check automated preview; automated deletion NOT enabled.**

The EC2 root disk reached 90% utilization with roughly 195 historical backend images. A manual cleanup restored approximately 21 GB free space. This utility targets only the RecruiterReply backend ECR repository, retaining 10 distinct backend images total when possible, including **all images referenced by any Docker container** (running or stopped).

## Review commands on EC2

```bash
sudo python3 scripts/recruiterreply-image-prune.py --keep 10
python3 -m unittest discover -s tests -p 'test_docker_image_prune.py'
df -h /
sudo docker system df
```

Preview is the default; the script does not delete images without `--apply`. An explicit manual `--apply` is possible **only after a separate approval**, confirming no deployment or rollback is running. Do not automate it yet.

The reusable Dev/Test/Prod promotion workflow installs the reviewed script, waits for the environment backend `/health` endpoint, releases the deployment side of `/tmp/recruiterreply-docker-deploy.lock`, and runs this preview under the same lock. Actions logs contain the candidate/protected counts, root filesystem metrics, `docker system df`, and a JSON `SUMMARY`. The manual EC2 deployment helper uses the same lock. The previous broad `docker image prune -f` step has been removed.

## Before enabling unattended cleanup

1. Verify any new out-of-band EC2 deployment or rollback path acquires `/tmp/recruiterreply-docker-deploy.lock`; repository-managed EC2 paths now share it.
2. Confirm images for approved/in-flight Test/Prod promotions are protected or reliably repullable by immutable SHA from ECR.
3. Review dry-run logs across Dev deployments before separately approving unattended `--apply`. Do not treat workflow-level concurrency as a substitute for the host lock.
4. Preserve and extend race, changed-tag, missing-image, multi-tag, Docker-error, stopped-container, and dry-run regression coverage.
5. Capture `df -h /` and `docker system df` before and after cleanup; alert when root utilization approaches 80%.

The script does not touch PostgreSQL images, volumes, containers, backups, or unrelated repositories. Docker may preserve layers shared by retained images. This **local EC2** retention policy is separate from AWS ECR lifecycle policies.
