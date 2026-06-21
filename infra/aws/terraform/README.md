# Terraform AWS Infrastructure

This Terraform stack provisions reusable AWS infrastructure for RecruiterReply across environments.

## What It Creates

- VPC with public and private subnets
- Internet Gateway and public route table
- Security groups for EC2 and RDS
- One EC2 instance for app workloads
- Optional RDS PostgreSQL instance
- Frontend S3 buckets for static React hosting

## Structure

- `main.tf`: Root module wiring
- `variables.tf`: Inputs for reuse
- `outputs.tf`: Useful values for CI/CD and DNS
- `modules/network`: VPC, subnets, routing
- `modules/security`: Security groups
- `modules/compute`: EC2 instance and IAM profile
- `modules/database`: Optional RDS PostgreSQL
- `modules/frontend`: S3 buckets for frontend assets
- `environments/*.tfvars`: Example environment-specific values

## Usage

```bash
cd infra/aws/terraform
terraform init
terraform plan -var-file=environments/dev.tfvars
terraform apply -var-file=environments/dev.tfvars
```

For staging and production:

```bash
terraform plan -var-file=environments/staging.tfvars
terraform apply -var-file=environments/staging.tfvars

terraform plan -var-file=environments/prod.tfvars
terraform apply -var-file=environments/prod.tfvars
```

## Notes

- Replace `ami_id` values with current region-appropriate AMIs.
- Replace bucket names with globally unique names.
- Provide `db_password` via `-var`, `.tfvars`, or secret manager integration if you do not want auto-generated credentials.
- For production, use remote state (S3 + DynamoDB lock table) before team usage.
