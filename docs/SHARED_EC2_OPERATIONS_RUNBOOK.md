# Shared EC2 deployment safety and split criteria

This runbook records the safety contract for the current one-host Dev/Test/Production topology. It is an operational guardrail and decision record; it does not provision infrastructure, change databases, or automatically split environments.

## Deployment contract

- Every Docker Compose mutation on the shared host acquires `/tmp/recruiterreply-docker-deploy.lock` with a bounded wait. The promotion workflow and the manual environment helper use the same lock.
- The promotion workflow checks the host before pulling an image, then targets exactly one `backend-{environment}` service. Compose may start the shared `postgres` dependency, but it never runs a broad `up`, `down`, prune, or cleanup operation.
- The preflight is read-only and fails closed when the target environment, Compose service, image variable, database name, Docker daemon, disk, memory, or load check is invalid.
- Image retention is policy-based and preview-only during normal promotion. Running and stopped container references and approved Dev/Test/Prod rollback SHAs remain protected. Deletion requires the separate manually approved retention workflow.
- A failed Dev or Test operation must not restart, remove, or reconfigure the Production service. The environment-to-service, port, database, and log-stream mapping is covered by `tests/test_shared_ec2_safety.py`.

| Environment | Compose service | Host health port | Database | Log stream |
| --- | --- | ---: | --- | --- |
| Dev | `backend-dev` | 5001 | `recruiterreply_dev` | `backend-dev` |
| Test | `backend-test` | 5002 | `recruiterreply_test` | `backend-test` |
| Production | `backend-prod` | 5003 | `recruiterreply_prod` | `backend-prod` |

## Preflight operating limits

The defaults are deliberately conservative for the current shared host and are tunable only through reviewed deployment configuration:

- Root filesystem must be below 80% used before an image pull or container recreation.
- At least 1 GiB of `MemAvailable` must remain.
- One-minute load must remain below 0.90 per online CPU.
- A deployment fails before pulling when any check cannot be read or any environment boundary does not match.

These limits protect the host; they are not split triggers by themselves. Operators should capture `df -h`, `docker system df`, memory, load, container restart counts, and deployment lock wait time when investigating pressure.

## CloudWatch evidence and gaps

The repository has a separate monitoring Terraform proposal and CloudWatch Agent configuration. The intended coverage is:

- EC2 status checks and CPU utilization.
- Agent memory utilization and root filesystem utilization.
- Application/container restart counts, deployment lock contention, database connections, EBS latency/queue/burst pressure, and request latency require explicit metric or log sources before they can be treated as covered.
- Existing unhandled-error alarms and default EC2 metrics must not be described as complete operational coverage; alarm notification actions and restore readiness require separate verification.

Do not record secrets, connection strings, customer data, or raw AWS response bodies in evidence. A read-only audit must distinguish verified live state, repository intent, and unknown state.

## Evidence-based split criteria

Open a topology-separation review when any condition is sustained and corroborated by deployment and service evidence:

- CPU or memory above 85% for at least 15 minutes, or repeated OOM/container restarts.
- Root disk above 80% warning and 90% critical, or cleanup cannot restore the approved operating margin.
- EBS latency, queue depth, or burst-balance pressure coincides with production latency or availability impact.
- Database connection exhaustion or measurable cross-environment query contention.
- Two or more deployments wait on the host lock long enough to miss their release objective, or a deployment causes production latency/availability impact.
- Backup or restore duration exceeds the approved recovery objective.
- A shared-host failure or rollback blast radius becomes unacceptable for the business.

For each candidate, retain timestamped metric evidence, affected environment, deployment SHA, lock wait, user-facing impact, and mitigation attempted. A single alarm or transient spike is an investigation signal, not authorization to create infrastructure.

## Operator response

1. Stop and preserve the failed deployment evidence; do not retry repeatedly while the preflight is failing.
2. Confirm the shared lock owner and current container/image state without removing containers or images.
3. Validate production health and database backup status independently.
4. If a threshold is sustained, create or update the infrastructure-separation decision with cost, data-movement, rollback, and recovery analysis.
5. Obtain separate approval before provisioning, changing Terraform state, installing monitoring agents, or splitting environments.

The decision process must not automatically provision replacement infrastructure when a threshold fires.
