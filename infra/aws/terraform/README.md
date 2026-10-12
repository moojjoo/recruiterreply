# Terraform AWS Infrastructure

This Terraform stack provisions AWS infrastructure for RecruiterReply, split into
one **global** root and one root per **environment** (`dev`, `test`, `prod`),
each with its own S3 remote state.

## Current deployed topology (Issue #342)

**The shared EC2 API host is managed only by `envs/dev`.** Dev, Test,
and Production use separate backend containers and PostgreSQL databases on
that host; their actual database isolation and Docker configuration must be
verified operationally, not inferred from Terraform. The global root owns the
three frontend CloudFront/S3 stacks. Existing backend secrets are named
`recruiterreply/{dev,test,prod}/backend-app-secrets` and are referenced by
metadata lookups, not created or populated by Terraform.

The `envs/test` and `envs/prod` roots deliberately contain **no managed
infrastructure resources**. They only resolve existing secret metadata. Their
former prospective standalone VPC/EC2/RDS configurations are archived as
`main.tf.dedicated-stack.example` and `outputs.tf.dedicated-stack.example`.
Do not rename those examples to `.tf` or apply them without a separately
reviewed architecture/cost/migration approval.

**Important:** Terraform plans can still show output-only state changes.
Review all plans, especially the Dev EC2 security-group ingress change and
`frontend_buckets` output removal, before any apply. No Test/Production
infrastructure deployment or state mutation is authorized by this change.

## Structure

- `global/`: account-wide resources, applied once
  - GitHub Actions OIDC provider + deploy role (`modules/github_oidc`), shared by
    `deploy-dev.yml`, `deploy-test.yml`, `deploy-prod.yml`
  - Frontend S3 buckets + CloudFront distributions for all three environments
    (`modules/frontend`, which fans out per environment internally via `for_each`)
  - State key: `recruiterreply/global/terraform.tfstate`
- `envs/dev/`: owns the existing shared EC2 API host, network, IAM, and optional RDS configuration.
- `envs/test/`, `envs/prod/`: metadata-only roots for existing per-environment secrets; no dedicated EC2, VPC, or RDS.
- `modules/`: shared reusable modules.

All four roots have separate Terraform state. Only `envs/dev` manages the shared API host.

## Usage

```bash
cd infra/aws/terraform/global
terraform init
terraform plan
terraform apply
```

```bash
cd infra/aws/terraform/envs/dev   # or envs/test, envs/prod
terraform init
terraform plan
terraform apply
```

Each `envs/<name>/terraform.tfvars` is loaded automatically by Terraform
(the file is literally named `terraform.tfvars`), so no `-var-file` flag is
needed.

## Deployments

The shared API host is managed by `envs/dev`; Test/Production deployment
workflows must continue targeting that existing host, with environment-specific
containers, secret names, and database names. Do not set a Test/Production
`EC2_INSTANCE_ID` from these metadata-only roots. Review deployment workflow
variables before changing any target.

## PostgreSQL backups

The `global` root creates a dedicated private S3 bucket named
`<app_name>-postgres-backups-<account_id>`. It blocks public access, requires
TLS and AES-256 server-side encryption, and expires objects after 30 days.
The existing shared-host IAM role must be reviewed for least-privilege access
to each required environment backup prefix. The prospective per-environment
EC2-role policies in the compute module are not deployed for Test/Production. The bucket is protected from accidental
Terraform destruction.

Do not apply any root until its plan is reviewed and explicitly approved. The
promotion workflow installs a daily 02:00 UTC backup timer and a monthly 03:00
UTC restore-test timer on the target host. The backup job reads the deployed
backend's connection string from Secrets Manager, verifies it identifies that
environment, stages a mode-0600 custom-format `pg_dump` on the encrypted EC2
root disk, validates it, and uploads it to S3 with AES-256 encryption. The
temporary dump is removed on exit; a failed dump does not replace an earlier
object.

The monthly restore check downloads the latest environment backup into a
temporary PostgreSQL container with a `tmpfs` data directory and no network.
It never connects to a live database or mounts, stops, or modifies an existing
Docker volume. To run it manually on the environment host:

```bash
sudo /usr/local/libexec/recruiterreply/test_postgres_backup_restore.sh prod
```

Substitute `dev` or `test` for those environments. Check timer/service results
with `systemctl list-timers 'recruiterreply-postgres-*'` and
`journalctl -u 'recruiterreply-postgres-backup@prod.service'` (or the matching
restore-test unit). The `global` and environment Terraform applies and an
environment promotion are still explicit operator actions; this change does
not run them.

## Notes

- Replace `ami_id` values with current region-appropriate AMIs as needed.
- Provide `db_password` via `-var`, a `*.auto.tfvars` file (gitignored), or
  Secrets Manager integration if you don't want auto-generated credentials.
- `global/terraform.tfvars` bucket names must stay globally unique across all
  of S3.
- See [`MIGRATION.md`](./MIGRATION.md) before running `terraform init` for the
  first time against these new backend keys — the existing single-state
  deployment needs to be split first, or `envs/dev` will try to recreate
  resources that already exist.
