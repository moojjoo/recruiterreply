# Migrating to per-environment state

Today all infrastructure lives in one S3 state file
(`recruiterreply/terraform.tfstate`), and what's actually deployed there is the
**dev** environment (`recruiterreply-development-*`, EC2 instance
`i-0dbe396e361ea6d56`) plus the account-wide frontend buckets/CloudFront and
the GitHub OIDC role. `envs/test` and `envs/prod` have never been applied —
`test`/`prod` deploys currently land on the dev box by accident, because all
three GitHub Actions workflows fall back to the same hardcoded
`EC2_INSTANCE_ID` when the per-environment variable isn't set.

This runbook splits that one state file into `recruiterreply/global/...` and
`recruiterreply/dev/...`, verifies nothing changed, and only then applies
`envs/test` and `envs/prod` to create their own dedicated VPC + EC2 (+ RDS).
Run this **before** merging the branch that removes the old root
`main.tf`/`versions.tf` — you need the old config in place to read the
existing state. Requires AWS credentials with access to the
`recruiterreply-terraform-state-178522450316` bucket.

## 1. Pull the current state and inspect it

From the **old** `infra/aws/terraform/` root (pre-restructure):

```bash
cd infra/aws/terraform
terraform init -reconfigure
terraform state list
```

Confirm the list splits cleanly into two groups:
- global: `module.github_oidc.*`, `module.frontend.*`
- dev: everything else (`module.network.*`, `module.security.*`,
  `module.compute.*`, `module.secrets.*`, and `module.database.*` if RDS is
  enabled)

```bash
terraform state pull > /tmp/old.tfstate
cp /tmp/old.tfstate /tmp/global.tfstate
```

## 2. Split into two local state files

Move the global-scoped modules out of the copy, leaving the original
untouched copy to become the dev state:

```bash
cp /tmp/old.tfstate /tmp/dev.tfstate

terraform state mv -state=/tmp/dev.tfstate -state-out=/tmp/global.tfstate \
  'module.github_oidc' 'module.github_oidc'
terraform state mv -state=/tmp/dev.tfstate -state-out=/tmp/global.tfstate \
  'module.frontend' 'module.frontend'
```

After this, `/tmp/global.tfstate` should contain only `module.github_oidc.*`
and `module.frontend.*`; `/tmp/dev.tfstate` should contain everything else.
Verify:

```bash
terraform state list -state=/tmp/global.tfstate
terraform state list -state=/tmp/dev.tfstate
```

## 3. Switch to the new layout and push each state

Now check out the branch with this restructure (`global/`, `envs/dev`,
`envs/test`, `envs/prod`, old root files removed).

```bash
cd infra/aws/terraform/global
terraform init
terraform state push /tmp/global.tfstate
terraform plan   # expect no changes
```

```bash
cd ../envs/dev
terraform init
terraform state push /tmp/dev.tfstate
terraform plan   # expect no changes
```

If `terraform plan` shows anything other than no-op / cosmetic diffs, stop and
investigate before proceeding — do not `apply` a plan you don't understand
against live resources.

## 4. Create test and prod

Only after step 3 is clean:

```bash
cd ../envs/test
terraform init
terraform apply     # creates a new VPC + EC2 (+ RDS) for test

cd ../prod
terraform init
terraform apply     # creates a new VPC + EC2 (+ RDS) for prod
```

These are new, billable resources — review the plan output before confirming.

## 5. Point deploys at the right instance

For each environment, grab its instance ID and set it as the `EC2_INSTANCE_ID`
GitHub Actions variable on the matching GitHub Environment (`dev`, `test`,
`prod`) so `deploy-<env>.yml` stops falling back to the shared hardcoded ID:

```bash
terraform output ec2_instance_id   # run in envs/dev, envs/test, envs/prod
```

Set it in GitHub: Settings → Environments → `<env>` → Environment variables →
`EC2_INSTANCE_ID`.

Once each environment has its own instance, `docker-compose.multi-env.yml`
running three backend containers on one box is no longer necessary — each
box only needs its own service. That change is out of scope for this
restructure and is a good follow-up once test/prod are confirmed healthy on
their own instances.

## 6. Clean up

Delete `/tmp/old.tfstate`, `/tmp/global.tfstate`, `/tmp/dev.tfstate` once
you've confirmed `terraform plan` is clean in `global/` and `envs/dev` and the
new `test`/`prod` instances are healthy.
