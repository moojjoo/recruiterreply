# CloudWatch monitoring — proposal only (Issue #199)

**DO NOT APPLY WITHOUT EXPLICIT APPROVAL.** This folder is intentionally separate from the existing `global` and `envs/*` Terraform roots. Their state is documented as unreconciled in `../MIGRATION.md`. This proposal must not trigger any AWS change from CI or be merged with auto-deployment.

## Scope
- Existing EC2 `i-0dbe396e361ea6d56` in `us-east-1` only. Does **not** create or modify EC2, network, databases, volumes, or application deployment.
- One SNS topic and email subscription; confirmation email requires human action.
- Four **standard** CloudWatch alarms: instance status, CPU, memory and root disk utilization.
- Minimal agent configuration in `../../monitoring/cloudwatch-agent.json`; no application log collection or Container Insights.
- Alarm actions notify only, no reboot/recovery.

## Proposed costs (not verified against current account pricing/usage)
Four standard alarms: approximately $0.40/month. Two custom metrics: approximately $0.60/month if only two unique metric series are emitted. **CloudWatch Agent may emit additional original/per-dimension metric series**, API calls may incur charges, and SNS/other services may incur usage costs. Inspect the published metric series and AWS billing before approving rollout. **$5/month is a target, not a cap.** Avoid detailed EC2 monitoring and extra log collection.

## Safe preflight — does not deploy
From `infra/aws/terraform/monitoring`:

```bash
terraform fmt -check
terraform init -backend=false
terraform validate
```

These commands check code locally but do not verify AWS IAM or live drift. **Do not run `terraform apply`, `terraform import`, or state push.** Before any later plan, choose a dedicated backend/state key for monitoring, check for preexisting SNS topics/alarms, and verify IAM/permissions and pricing. No backend is configured in this proposal, deliberately.

## Agent installation — manual runbook, NOT executed
1. Confirm the actual EC2 instance ID and role/profile, SSM Online status, root filesystem mount, and absence of an existing CloudWatch Agent.
2. Obtain explicit approval to install/configure the agent and to grant its instance role `CloudWatchAgentServerPolicy` or a narrower equivalent. Do not replace the instance profile or change Docker.
3. Use AWS Systems Manager Run Command or Session Manager to install the Ubuntu `amazon-cloudwatch-agent` package and place `infra/aws/monitoring/cloudwatch-agent.json` on the host (path chosen by operator). **Do not execute commands from a PR automatically.**
4. On the EC2 host after approval, load the file using:
   ```bash
   sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
     -a fetch-config -m ec2 -s -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
   ```
5. Inspect CloudWatch namespace `CWAgent` for `mem_used_percent` and `disk_used_percent`, both with `InstanceId` dimension. Verify the aggregated disk metric represents only root mount and does not unintentionally aggregate multiple disks. Confirm alarm dimensions and metric counts; adjust configuration before approval if they differ.
6. Confirm SNS subscription and test notifications by controlled alarm testing. Never intentionally exhaust disk or memory in production.

## Deployment approval checklist
- [ ] Separate monitoring Terraform state selected and safely initialized
- [ ] Existing alarms/topic inventoried to avoid duplication
- [ ] Exact emitted metric names, dimensions and series count verified
- [ ] CloudWatch Agent IAM policy reviewed for existing instance role
- [ ] Terraform plan inspected: **only** monitoring SNS and alarms
- [ ] Estimated incremental monthly cost within $5 target
- [ ] Owner explicitly approves agent installation and Terraform apply
- [ ] SNS email confirmation and notification test
- [ ] Rollback plan: remove monitoring alarms/topic via dedicated state and stop agent; do not modify DB, Docker or EC2 lifecycle

## Limitations
Repository-only review cannot establish current AWS resources, Terraform state, existing IAM permissions, actual billing, or agent metrics. These must be checked before rollout.
