# Terraform drift audit — issue #342

This is a **read-only audit scaffold**, not proof that live AWS resources match Terraform.

The workflow `Terraform read-only drift audit` is manually dispatched and uses the protected GitHub environment `terraform-readonly-audit`. Before running, create that environment with owner approval and set its environment variable `TERRAFORM_AUDIT_ROLE_ARN` to an AWS IAM role that trusts only the expected GitHub OIDC workflow/repository/environment. Grant read-only AWS describe/list/get and the minimum S3/KMS permissions needed to read existing Terraform state. **Do not grant state writes, state lock mutations, or Terraform apply permissions.** The existing backend may still attempt state lock operations on init; confirm the IAM policy and backend behavior before execution.

Each of four Terraform roots is validated and compared with remote state:
- `infra/aws/terraform/global`
- `infra/aws/terraform/envs/dev`
- `infra/aws/terraform/envs/test`
- `infra/aws/terraform/envs/prod`

Commands use `terraform init -input=false -lockfile=readonly -migrate-state=false`, `terraform validate`, and read-only `terraform plan -refresh-only -lock=false -detailed-exitcode` plus a normal plan with `-lock=false`. No apply/import/state mutation. Only exit statuses are published; full plan output may contain secrets and is not uploaded.

**Interpretation:** 0 means no change, 2 means drift or proposed changes, 1 means an error (permissions, missing variables, backend problems, etc.). The two plan exit statuses are distinct and do not identify affected resources by themselves.

## Remaining evidence needed before closing #342
1. Review workflow permissions and IAM trust, then execute with approved AWS read-only role.
2. Record run URL, commit SHA, Terraform/provider versions and exit status for each root.
3. Independently inspect **redacted** resource-level differences and AWS inventory: CloudFront distributions/functions, S3 OAC/bucket policies, IAM/OIDC, EC2/security groups, Secrets Manager, database/backups, and manual/unmanaged resources.
4. Distinguish actual AWS drift, unapplied desired changes, unmanaged resources, and permission failures. Never treat a passing CI run as proof of no drift without examining results.
5. Prepare separate remediation PRs and reviewed plans; no live AWS writes without explicit approval.

No Dev/Test/Production promotion or Terraform apply is authorized by this issue.
