# Migrating legacy Terraform state

The legacy root stored dev and account-wide resources in
`recruiterreply/terraform.tfstate`. The current roots use
`recruiterreply/global/terraform.tfstate` and
`recruiterreply/dev/terraform.tfstate`. The current `main` tree no longer
contains the legacy root; it is available at commit
`223b86d7334ae8c0107e1daafd3096a9c8ec0d55`.

This procedure only migrates Terraform state. It must not apply AWS resource
changes, provision test/prod, or update DNS. State files can contain secrets:
keep them out of chat and version control.

## 1. Prepare a secure workspace and read the legacy state

Use a detached worktree so the current checkout stays on the new layout:

```bash
git worktree add --detach /tmp/recruiterreply-terraform-legacy \
  223b86d7334ae8c0107e1daafd3096a9c8ec0d55
```

Create a private temporary directory before writing state files:

```bash
umask 077
STATE_DIR="$(mktemp -d)"
chmod 700 "$STATE_DIR"
```

From the legacy worktree, initialize the legacy S3 backend and inspect the
resource addresses:

```bash
cd /tmp/recruiterreply-terraform-legacy/infra/aws/terraform
terraform init -reconfigure -input=false
terraform state list
terraform state pull > "$STATE_DIR/old.tfstate"
cp "$STATE_DIR/old.tfstate" "$STATE_DIR/dev.tfstate"
chmod 600 "$STATE_DIR/old.tfstate" "$STATE_DIR/dev.tfstate"
```

Confirm the legacy state contains both expected groups:

- Global: `module.github_oidc.*` and `module.frontend.*`
- Dev: `module.network.*`, `module.security.*`, `module.compute.*`,
  `module.secrets.*`, and `module.database.*` if RDS is enabled

## 2. Split and verify locally

Move only the global modules out of the dev copy. Do not pre-create
`global.tfstate`; the first `state mv` creates it with only the moved module.

```bash
terraform state mv -state="$STATE_DIR/dev.tfstate" \
  -state-out="$STATE_DIR/global.tfstate" \
  'module.github_oidc' 'module.github_oidc'
terraform state mv -state="$STATE_DIR/dev.tfstate" \
  -state-out="$STATE_DIR/global.tfstate" \
  'module.frontend' 'module.frontend'
```

Verify the global and dev address lists are disjoint and their union matches
the original address list. Confirm the dev state still contains the deployed
EC2 instance and other expected environment resources. Stop if any resource is
missing, duplicated, or assigned to the wrong state.

## 3. Check destinations before any remote write

The target keys must be absent or empty before pushing split state. Inspect the
S3 objects and versions for both exact keys:

- `recruiterreply/global/terraform.tfstate`
- `recruiterreply/dev/terraform.tfstate`

If either key already contains state, **stop**. Do not overwrite or delete it,
and do not use `terraform state push -force`. Read-only `terraform state list`
checks may be used to establish what each existing state tracks; obtain explicit
recovery approval before changing populated state objects.

Before any push, verify the AWS account, bucket, and that the checked-out
backend configuration maps `global/` to the global key and `envs/dev/` to the
dev key. Run `terraform init -reconfigure -input=false` in both roots so stale
local backend metadata cannot direct a command to the wrong key.

Only when both destination keys are confirmed empty and the split has been
reviewed, push without `-force`:

```bash
cd /path/to/recruiterreply/infra/aws/terraform/global
terraform init -reconfigure -input=false
terraform state push "$STATE_DIR/global.tfstate"

cd /path/to/recruiterreply/infra/aws/terraform/envs/dev
terraform init -reconfigure -input=false
terraform state push "$STATE_DIR/dev.tfstate"
```

Verify each remote state list matches its local split. If a push is rejected,
stop and investigate; do not force it.

## 4. Review plans without applying

Run `terraform plan -input=false` in `global/` and `envs/dev/`. Review every
proposed action. Stop if there are unexpected creates, replacements, or
deletions, especially for the existing EC2 instance, its root volume, or any
database. No `terraform apply` is part of this migration.

Do not initialize or apply `envs/test` or `envs/prod`, and do not change GitHub
environment variables, DNS, or EIP resources as part of this issue.

Keep the original legacy S3 object untouched. Retain the local backup securely
until both remote state lists and plans have been reviewed; then remove only
the temporary state files and detached worktree created for this procedure.
