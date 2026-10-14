# RecruiterReply EC2 Docker image retention (Issue #385)

**Status: manual dry-run utility; automated deletion NOT enabled.**

The EC2 root disk reached 90% utilization with roughly 195 historical backend images. A manual cleanup restored approximately 21 GB free space. This utility targets only the RecruiterReply backend ECR repository, retaining 10 distinct backend images total when possible, including **all images referenced by any Docker container** (running or stopped).

## Review commands on EC2

```bash
sudo python3 scripts/recruiterreply-image-prune.py --keep 10
python3 -m unittest discover -s tests -p 'test_docker_image_prune.py'
df -h /
sudo docker system df
```

Preview is the default; the script does not delete images without `--apply`. An explicit manual `--apply` is possible **only after a separate approval**, confirming no deployment or rollback is running. Do not automate it yet.

## Before enabling unattended cleanup

1. Ensure *every* Dev/Test/Prod deployment, image pull, rollback, and cleanup acquires the **same EC2 host lock** (`/var/lock/recruiterreply-docker-deploy.lock`). The script currently locks only against other script instances; this alone does **not** coordinate with existing deployments.
2. Confirm images for approved/in-flight Test/Prod promotions are protected or reliably repullable by immutable SHA from ECR.
3. Add cleanup as a post-success, post-health-check deployment step; verify the actual current workflow/SSM execution path. Do not treat workflow-level concurrency as a substitute for the host lock.
4. Add integration tests for races, changing tags, missing images, multiple tags, Docker errors, and stopped containers. Review logs and require explicit approval to enable destructive execution.
5. Capture `df -h /` and `docker system df` before and after cleanup; alert when root utilization approaches 80%.

The script does not touch PostgreSQL images, volumes, containers, backups, or unrelated repositories. Docker may preserve layers shared by retained images. This **local EC2** retention policy is separate from AWS ECR lifecycle policies.
