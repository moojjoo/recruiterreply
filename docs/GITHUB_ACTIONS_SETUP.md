# GitHub Actions & AWS Setup Checklist

Use this checklist to ensure your RecruiterReply deployment pipeline is properly configured.

## AWS Account Setup

- [ ] **S3 Bucket Created**: `recruiterreply-terraform-state-ACCOUNT_ID`
- [ ] **S3 Versioning Enabled**: On state bucket
- [ ] **S3 Public Access Blocked**: Enabled
- [ ] **DynamoDB Table Created**: `recruiterreply-terraform-locks`
- [ ] **OIDC Provider Configured**: `token.actions.githubusercontent.com`
- [ ] **IAM Role Created**: `GitHubActionsRecruiterReplyDeployer`
- [ ] **IAM Policies Attached**:
  - [ ] `s3-policy.json` (S3 & CloudFront)
  - [ ] `terraform-policy.json` (Infrastructure)
  - [ ] `ECR policy` (Docker images)
- [ ] **Secrets Manager Secrets Created**:
  - [ ] `recruiterreply/dev`
  - [ ] `recruiterreply/prod`

## GitHub Repository Setup

### Repository Secrets

Set these in **Settings → Secrets and variables → Actions → Secrets**:

- [ ] `AWS_ROLE_TO_ASSUME` = `arn:aws:iam::ACCOUNT_ID:role/GitHubActionsRecruiterReplyDeployer`
- [ ] `TF_STATE_BUCKET` = `recruiterreply-terraform-state-ACCOUNT_ID`
- [ ] `TF_LOCK_TABLE` = `recruiterreply-terraform-locks`
- [ ] `AWS_REGION` = `us-east-1` (or your region)

### Repository Variables

Set these in **Settings → Secrets and variables → Actions → Variables**:

#### Dev Environment
- [ ] `ENVIRONMENT_DEV` = `development`
- [ ] `S3_FRONTEND_BUCKET` = `recruiterreply-dev-frontend-ACCOUNT_ID`
- [ ] `EC2_DEPLOY_PATH` = `/home/ubuntu/recruiterreply`
- [ ] `FRONTEND_API_BASE_URL` = `https://api-dev.recruiterreply.com`

#### Prod Environment
- [ ] `ENVIRONMENT_PROD` = `production`
- [ ] `S3_FRONTEND_BUCKET` = `recruiterreply-prod-frontend-ACCOUNT_ID`
- [ ] `EC2_DEPLOY_PATH` = `/home/ubuntu/recruiterreply`
- [ ] `FRONTEND_API_BASE_URL` = `https://api.recruiterreply.com`

### GitHub Environments

Create environments in **Settings → Environments**:

#### Development Environment (`dev`)
- [ ] Created
- [ ] No approval required
- [ ] Deployment branches: `dev`

#### Production Environment (`prod`)
- [ ] Created
- [ ] Reviewers required
- [ ] Deployment branches: `main`

## Terraform Configuration

### Environment Files

- [ ] `infra/aws/terraform/environments/dev.tfvars`
  - [ ] AWS region set correctly
  - [ ] Availability zones match your region
  - [ ] VPC CIDR: `10.30.0.0/16`
  - [ ] Public subnets: `10.30.1.0/24`, `10.30.2.0/24`
  - [ ] Private subnets: `10.30.10.0/24`, `10.30.20.0/24`
  - [ ] EC2 AMI ID (correct region)
  - [ ] Instance type: `t3.small`
  - [ ] EC2 Key pair name specified
  - [ ] SSH CIDR restricted to your IP
  - [ ] Frontend bucket names unique

- [ ] `infra/aws/terraform/environments/prod.tfvars`
  - [ ] All of above but for prod
  - [ ] Instance type: `t3.medium` or larger
  - [ ] Multi-AZ enabled for RDS
  - [ ] Backups enabled

## GitHub Actions Workflows

### Infrastructure Workflow
- [ ] `.github/workflows/infrastructure.yml` exists
- [ ] Triggers on:
  - [ ] Push to `main` and `dev`
  - [ ] Terraform path changes
  - [ ] Manual workflow_dispatch
- [ ] Plan step runs
- [ ] Apply step requires approval (prod)

### Application Workflows
- [ ] `.github/workflows/deploy-dev.yml` exists
- [ ] `.github/workflows/deploy-prod.yml` exists (if needed)
- [ ] Triggers on:
  - [ ] Push to `dev` branch (dev workflow)
  - [ ] Push to `main` branch (prod workflow)
  - [ ] Manual trigger available
- [ ] Docker image built successfully
- [ ] Frontend built and uploaded to S3
- [ ] CloudFront cache invalidated
- [ ] Backend deployed to EC2

## DNS & Domain Setup

- [ ] Domain registered (recruiterreply.com)
- [ ] Route 53 hosted zone created
- [ ] DNS records created:
  - [ ] `dev.recruiterreply.com` → CloudFront
  - [ ] `api-dev.recruiterreply.com` → EC2 Public IP
  - [ ] `recruiterreply.com` → CloudFront
  - [ ] `api.recruiterreply.com` → EC2 Public IP
- [ ] SSL Certificate created (ACM)

## Application Configuration

- [ ] EC2 Security Groups configured:
  - [ ] Inbound port 22 (SSH) from your IP
  - [ ] Inbound port 80 (HTTP) from 0.0.0.0/0
  - [ ] Inbound port 443 (HTTPS) from 0.0.0.0/0
  - [ ] Inbound port 5000 (Backend) from ALB/Private subnets

- [ ] Backend environment variables set:
  - [ ] `OPENAI_API_KEY`
  - [ ] `JWT_SECRET`
  - [ ] `DATABASE_URL`
  - [ ] `ASPNETCORE_URLS=http://+:5000`

- [ ] Frontend environment variables:
  - [ ] `VITE_API_BASE_URL` set correctly

## Testing & Validation

- [ ] First Terraform plan runs successfully
- [ ] Terraform apply creates resources
- [ ] EC2 instance is running
- [ ] Security groups allow traffic
- [ ] Backend Docker image builds
- [ ] Frontend build completes
- [ ] S3 upload succeeds
- [ ] CloudFront distribution accessible
- [ ] Application loads at `https://dev.recruiterreply.com`
- [ ] API is accessible at `https://api-dev.recruiterreply.com`
- [ ] OpenAI integration works
- [ ] Database connections successful

## Monitoring & Logging

- [ ] CloudWatch logs configured
- [ ] CloudTrail enabled for audit
- [ ] GitHub Actions logs visible
- [ ] Email alerts configured for failures
- [ ] Cost budget alerts set

## Security

- [ ] IAM role has minimal permissions (least privilege)
- [ ] No hardcoded secrets in code
- [ ] All secrets in AWS Secrets Manager
- [ ] OIDC authentication used (not IAM keys)
- [ ] SSH key secured (stored safely locally)
- [ ] API keys rotated monthly
- [ ] .gitignore includes sensitive files
- [ ] No credentials in Terraform files

## Post-Deployment

- [ ] Smoke tests pass
- [ ] Application accessible publicly
- [ ] SSL certificate valid
- [ ] Custom domain resolves
- [ ] Error handling working
- [ ] Logging configured
- [ ] Backups scheduled (if RDS enabled)
- [ ] Documentation updated

---

## Quick Reference: AWS CLI Commands

```bash
# List EC2 instances
aws ec2 describe-instances --filters "Name=tag:Environment,Values=dev"

# Get EC2 public IP
aws ec2 describe-instances \
  --instance-ids i-xxxxx \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text

# SSH into EC2
ssh -i your-key.pem ubuntu@EC2_PUBLIC_IP

# View S3 bucket contents
aws s3 ls s3://recruiterreply-dev-frontend-xxxxx/ --recursive

# Get CloudFront distribution details
aws cloudfront get-distribution --id E1234567890ABC

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id E1234567890ABC --paths '/*'

# Get Terraform outputs
cd infra/aws/terraform
terraform output

# Destroy infrastructure (careful!)
terraform destroy -var-file="environments/dev.tfvars"
```

---

## Troubleshooting Quick Links

- [Infrastructure Issues](TROUBLESHOOTING.md#infrastructure)
- [GitHub Actions Issues](TROUBLESHOOTING.md#github-actions)
- [Application Issues](TROUBLESHOOTING.md#application)
- [DNS Issues](TROUBLESHOOTING.md#dns)

---

**Status:** Use this checklist to track your progress  
**Version:** 1.0  
**Last Updated:** 2026-08-14
