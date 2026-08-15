# Terraform AWS Infrastructure

This Terraform stack provisions AWS infrastructure for RecruiterReply, split into
one **global** root and one root per **environment** (`dev`, `test`, `prod`),
each with its own S3 remote state.

## Structure

- `global/`: account-wide resources, applied once
  - GitHub Actions OIDC provider + deploy role (`modules/github_oidc`), shared by
    `deploy-dev.yml`, `deploy-test.yml`, `deploy-prod.yml`
  - Frontend S3 buckets + CloudFront distributions for all three environments
    (`modules/frontend`, which fans out per environment internally via `for_each`)
  - State key: `recruiterreply/global/terraform.tfstate`
- `envs/dev/`, `envs/test/`, `envs/prod/`: one root per environment, each wiring:
  - `modules/network`: VPC, subnets, routing
  - `modules/security`: security groups
  - `modules/compute`: one EC2 instance and IAM instance profile
  - `modules/secrets`: Secrets Manager secret for backend runtime config
  - `modules/database`: optional RDS PostgreSQL (`enable_rds` in that env's tfvars)
  - State key: `recruiterreply/<env>/terraform.tfstate`
- `modules/`: shared, reusable modules referenced by the roots above

Each environment root gets its own VPC and its own EC2 instance, isolated in
its own state file — a `terraform apply` in `envs/prod` can't touch `envs/dev`'s
resources or vice versa.

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

## After applying an environment

`envs/<name>` outputs `ec2_instance_id`. Set that as the `EC2_INSTANCE_ID`
GitHub Actions variable on the corresponding GitHub Environment (`dev`, `test`,
`prod`) so `deploy-<env>.yml` targets the right instance — see
[`MIGRATION.md`](./MIGRATION.md) for why this matters today.

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
