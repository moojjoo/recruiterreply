# RecruiterReply - AWS Deployment & GitHub Actions Setup Guide

This guide walks you through deploying RecruiterReply to AWS with a fully automated CI/CD pipeline using GitHub Actions.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [AWS Account Setup](#aws-account-setup)
3. [GitHub Repository Configuration](#github-repository-configuration)
4. [Infrastructure Deployment](#infrastructure-deployment)
5. [Application Deployment](#application-deployment)
6. [Monitoring & Troubleshooting](#monitoring--troubleshooting)

---

## Prerequisites

### Required Tools
- AWS Account (free tier or paid)
- GitHub Account with repo access
- AWS CLI configured locally (for testing)
- Terraform 1.6+ (for local planning)
- Docker (for building images)

### Service Requirements
- Domain name (recruiterreply.com)
- OpenAI API Key
- GitHub secrets/variables access

---

## AWS Account Setup

### Step 1: Create S3 Backend for Terraform State

Terraform state must be stored in S3 with locking. Create these resources:

```bash
# 1. Create S3 bucket for Terraform state
aws s3api create-bucket \
  --bucket recruiterreply-terraform-state-$(aws sts get-caller-identity --query Account --output text) \
  --region us-east-1

# 2. Enable versioning
BUCKET_NAME="recruiterreply-terraform-state-$(aws sts get-caller-identity --query Account --output text)"
aws s3api put-bucket-versioning \
  --bucket "$BUCKET_NAME" \
  --versioning-configuration Status=Enabled

# 3. Block public access
aws s3api put-public-access-block \
  --bucket "$BUCKET_NAME" \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# 4. Create DynamoDB table for state locking
aws dynamodb create-table \
  --table-name recruiterreply-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

**Save these values for later:**
- S3 Bucket: `recruiterreply-terraform-state-ACCOUNT_ID`
- DynamoDB Table: `recruiterreply-terraform-locks`

### Step 2: Create IAM Role for GitHub Actions (OIDC)

RecruiterReply uses OIDC for keyless GitHub Actions authentication. This is more secure than static keys.

```bash
# 1. Create trust policy for GitHub
cat > trust-policy.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:moojjoo/recruiterreply:*"
        }
      }
    }
  ]
}
EOF

# 2. Replace ACCOUNT_ID with your actual AWS Account ID
sed -i "s/ACCOUNT_ID/$(aws sts get-caller-identity --query Account --output text)/g" trust-policy.json

# 3. Create the role
aws iam create-role \
  --role-name GitHubActionsRecruiterReplyDeployer \
  --assume-role-policy-document file://trust-policy.json

# 4. Attach policies
ROLE_NAME="GitHubActionsRecruiterReplyDeployer"

# Policy for EC2 management
aws iam attach-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/EC2InstanceProfileForImageBuilder

# Policy for S3 frontend bucket access
cat > s3-policy.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::recruiterreply-*-frontend-*/*",
        "arn:aws:s3:::recruiterreply-*-frontend-*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "cloudfront:CreateInvalidation",
        "cloudfront:GetDistribution"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:CreateRepository",
        "ecr:DescribeRepositories",
        "ecr:BatchGetImage",
        "ecr:GetDownloadUrlForLayer",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:*:*:secret:recruiterreply-*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "sts:GetCallerIdentity"
      ],
      "Resource": "*"
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name RecruiterReplyDeploymentPolicy \
  --policy-document file://s3-policy.json

# Terraform backend policy
cat > terraform-policy.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket",
        "s3:GetBucketVersioning",
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::recruiterreply-terraform-state-*",
        "arn:aws:s3:::recruiterreply-terraform-state-*/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:DescribeTable",
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:DeleteItem"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/recruiterreply-terraform-locks"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ec2:*",
        "rds:*",
        "elasticloadbalancing:*",
        "iam:*",
        "s3:*",
        "cloudfront:*",
        "route53:*",
        "logs:*",
        "kms:*"
      ],
      "Resource": "*"
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name TerraformManagementPolicy \
  --policy-document file://terraform-policy.json
```

**Save this value:**
- IAM Role ARN: `arn:aws:iam::ACCOUNT_ID:role/GitHubActionsRecruiterReplyDeployer`

### Step 3: Setup AWS Secrets Manager

Store sensitive values that will be injected into the application:

```bash
aws secretsmanager create-secret \
  --name recruiterreply/dev \
  --description "RecruiterReply Development Secrets" \
  --secret-string '{
    "OPENAI_API_KEY": "sk-proj-YOUR_KEY_HERE",
    "JWT_SECRET": "your-jwt-secret-key-here",
    "JWT_ISSUER": "https://recruiterreply.com",
    "DATABASE_URL": "postgresql://user:password@rds-endpoint:5432/recruiterreply_dev"
  }'

aws secretsmanager create-secret \
  --name recruiterreply/prod \
  --description "RecruiterReply Production Secrets" \
  --secret-string '{
    "OPENAI_API_KEY": "sk-proj-YOUR_PROD_KEY",
    "JWT_SECRET": "your-prod-jwt-secret-key",
    "JWT_ISSUER": "https://recruiterreply.com",
    "DATABASE_URL": "postgresql://user:password@rds-prod-endpoint:5432/recruiterreply"
  }'
```

---

## GitHub Repository Configuration

### Step 1: Set Repository Secrets

Go to **Settings → Secrets and variables → Actions** and add:

#### Required Secrets

| Secret Name | Value | Example |
|---|---|---|
| `AWS_ROLE_TO_ASSUME` | IAM Role ARN from Step 2 | `arn:aws:iam::123456789:role/GitHubActionsRecruiterReplyDeployer` |
| `TF_STATE_BUCKET` | S3 bucket from Step 1 | `recruiterreply-terraform-state-123456789` |
| `TF_LOCK_TABLE` | DynamoDB table from Step 1 | `recruiterreply-terraform-locks` |
| `AWS_REGION` | AWS region | `us-east-1` |

### Step 2: Set Repository Variables

Go to **Settings → Secrets and variables → Variables** and add:

#### Environment Variables - Development

| Variable Name | Value | Notes |
|---|---|---|
| `ENVIRONMENT_DEV` | `development` | Used for dev deployments |
| `S3_FRONTEND_BUCKET` | `recruiterreply-dev-frontend-ACCOUNT_ID` | Must be globally unique |
| `CLOUDFRONT_DISTRIBUTION_ID` | (from Terraform output) | Set after first deployment |
| `EC2_INSTANCE_ID` | (from Terraform output) | Set after first deployment |
| `EC2_DEPLOY_PATH` | `/home/ubuntu/recruiterreply` | Application path on EC2 |

#### Environment Variables - Production

| Variable Name | Value | Notes |
|---|---|---|
| `ENVIRONMENT_PROD` | `production` | Used for prod deployments |
| `S3_FRONTEND_BUCKET` | `recruiterreply-prod-frontend-ACCOUNT_ID` | Must be globally unique |
| `CLOUDFRONT_DISTRIBUTION_ID` | (from Terraform output) | Set after first deployment |
| `EC2_INSTANCE_ID` | (from Terraform output) | Set after first deployment |

### Step 3: Create GitHub Environments

Go to **Settings → Environments** and create two environments:

1. **dev**
   - Add approval reviewers (optional)
   - Add reviewers: your GitHub username

2. **prod**
   - Add required reviewers (recommended)
   - Add reviewers: team members

---

## Infrastructure Deployment

### Step 1: Update Terraform Variables

Edit `infra/aws/terraform/environments/dev.tfvars`:

```hcl
aws_region   = "us-east-1"
app_name     = "recruiterreply"
environment  = "development"

# 2 public subnets (for ALB/NAT)
# 2 private subnets (for backend/RDS)
availability_zones   = ["us-east-1a", "us-east-1b"]
public_subnet_cidrs  = ["10.30.1.0/24", "10.30.2.0/24"]
private_subnet_cidrs = ["10.30.10.0/24", "10.30.20.0/24"]

# EC2 Configuration
ami_id        = "ami-0c55b159cbfafe1f0"  # Ubuntu 22.04 LTS in us-east-1
instance_type = "t3.small"  # Small instance for dev
key_name      = "your-ec2-keypair-name"  # Must exist in AWS

# SSH access (restrict to your IP)
allowed_ssh_cidrs = ["YOUR_PUBLIC_IP/32"]

# Database (optional for dev)
enable_rds                 = false
db_skip_final_snapshot     = true
db_deletion_protection     = false

# Frontend buckets
create_frontend_buckets = true
frontend_bucket_names = {
  dev  = "recruiterreply-dev-frontend-YOUR_ACCOUNT_ID"
  test = "recruiterreply-test-frontend-YOUR_ACCOUNT_ID"
  prod = "recruiterreply-prod-frontend-YOUR_ACCOUNT_ID"
}
```

### Step 2: Deploy Infrastructure

Push your changes to trigger the workflow:

```bash
cd /home/moojjoo/repos/recruiterreply
git add infra/aws/terraform/environments/
git commit -m "chore: update terraform variables for dev environment"
git push origin feature_19_Google_Auth  # Or your current branch
```

**Monitor the deployment:**

1. Go to GitHub → **Actions** tab
2. Find "Deploy Infrastructure (Terraform)" workflow
3. Watch the plan and apply steps
4. After successful deployment, note the outputs:
   - VPC ID
   - EC2 Public IP
   - Public/Private Subnet IDs

---

## Application Deployment

### Step 1: Configure Environment-Specific Settings

Update the deploy workflows to reference your infrastructure:

**For dev environment (.github/workflows/deploy-dev.yml):**

```yaml
env:
  EC2_INSTANCE_ID: <from Terraform output>
  S3_FRONTEND_BUCKET: recruiterreply-dev-frontend-YOUR_ACCOUNT_ID
  CLOUDFRONT_DISTRIBUTION_ID: <from Terraform output>
  API_BASE_URL: https://api-dev.recruiterreply.com
```

### Step 2: Set Up DNS Records

In Route 53, create these records:

```
dev.recruiterreply.com          CNAME → [CloudFront Distribution Domain]
api-dev.recruiterreply.com      A     → [EC2 Public IP]
test.recruiterreply.com         CNAME → [CloudFront Distribution Domain]
api-test.recruiterreply.com     A     → [EC2 Public IP]
recruiterreply.com              CNAME → [CloudFront Distribution Domain]
api.recruiterreply.com          A     → [EC2 Public IP]
```

### Step 3: Deploy Application

Push code to trigger deployments:

```bash
# Deploy to dev
git push origin dev

# Deploy to prod
git push origin main
```

**Deployment Flow:**
1. GitHub Actions builds backend Docker image
2. Pushes to ECR
3. Builds React frontend
4. Uploads frontend to S3
5. Invalidates CloudFront cache
6. Deploys backend container to EC2

---

## Monitoring & Troubleshooting

### View Logs

**GitHub Actions:**
- Go to **Actions** → select workflow run → view logs

**EC2 Application Logs:**
```bash
# SSH into EC2
ssh -i your-key.pem ubuntu@EC2_PUBLIC_IP

# View container logs
docker logs backend-dev
docker logs backend-prod

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
```

**CloudWatch Logs:**
```bash
aws logs tail /aws/ec2/recruiterreply --follow
```

### Common Issues

#### 1. Terraform State Lock
```bash
# If state is locked, unlock it
aws dynamodb delete-item \
  --table-name recruiterreply-terraform-locks \
  --key '{"LockID": {"S": "recruiterreply/dev/terraform.tfstate"}}'
```

#### 2. ECR Image Push Fails
```bash
# Ensure IAM role has ECR permissions
# Check role policy:
aws iam get-role-policy \
  --role-name GitHubActionsRecruiterReplyDeployer \
  --policy-name RecruiterReplyDeploymentPolicy
```

#### 3. S3 Upload Fails
```bash
# Verify bucket exists and GitHub role has access
aws s3 ls s3://recruiterreply-dev-frontend-YOUR_ACCOUNT_ID/
```

---

## Costs Optimization

### Expected Monthly Costs (Development)

| Service | Config | Monthly Cost |
|---------|--------|--------------|
| EC2 | t3.small (~730h) | ~$10 |
| S3 | Frontend storage (~100MB) | <$1 |
| RDS | db.t3.micro (optional) | ~$15 |
| NAT Gateway | 1 gateway | ~$32 |
| **Total** | **Dev Setup** | **~$60** |

### Cost-Saving Tips

1. **Stop EC2 during development:**
   ```bash
   aws ec2 stop-instances --instance-ids i-xxxxx
   ```

2. **Remove NAT Gateway when not needed:**
   Update `enable_nat = false` in Terraform

3. **Use EC2 Spot instances for dev:**
   Change instance type to spot instance (requires Terraform update)

---

## Next Steps

1. **Configure SSL Certificates:**
   ```bash
   # Use AWS Certificate Manager for free certificates
   aws acm request-certificate \
     --domain-name recruiterreply.com \
     --subject-alternative-names api.recruiterreply.com dev.recruiterreply.com
   ```

2. **Set Up Application Monitoring:**
   - CloudWatch Dashboards
   - Application Performance Monitoring (APM)
   - Error tracking (Sentry)

3. **Implement CI/CD Best Practices:**
   - Add approval gates for production
   - Implement blue-green deployments
   - Add smoke tests

---

## Support & Documentation

- [AWS Terraform Modules](infra/aws/terraform/modules)
- [GitHub Actions Workflows](.github/workflows)
- [Architecture Documentation](docs/BACKEND_ARCHITECTURE.md)
- [Deployment Guide](docs/AWS_DEV_DEPLOY.md)

---

**Last Updated:** 2026-08-14  
**Version:** 1.0  
**Maintainer:** RecruiterReply Team
