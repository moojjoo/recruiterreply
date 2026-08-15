#!/bin/bash
#
# RecruiterReply AWS Infrastructure Setup Script
#
# This script automates the AWS account setup for RecruiterReply deployment.
# Run this once to prepare your AWS account for GitHub Actions CI/CD.
#
# Prerequisites:
# - AWS CLI configured: aws configure
# - jq installed: apt-get install jq (or brew install jq on macOS)
# - Access to create IAM roles, S3 buckets, and DynamoDB tables
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
GITHUB_REPO="moojjoo/recruiterreply"
APP_NAME="recruiterreply"

echo -e "${BLUE}=== RecruiterReply AWS Infrastructure Setup ===${NC}\n"

# Step 1: Get AWS Account ID
echo -e "${YELLOW}Step 1: Retrieving AWS Account ID...${NC}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "${GREEN}✓ Account ID: $ACCOUNT_ID${NC}\n"

# Step 2: Create S3 bucket for Terraform state
echo -e "${YELLOW}Step 2: Creating S3 bucket for Terraform state...${NC}"
BUCKET_NAME="$APP_NAME-terraform-state-$ACCOUNT_ID"
if aws s3api head-bucket --bucket "$BUCKET_NAME" 2>/dev/null; then
    echo -e "${GREEN}✓ Bucket already exists: $BUCKET_NAME${NC}"
else
    aws s3api create-bucket \
        --bucket "$BUCKET_NAME" \
        --region "$AWS_REGION" \
        --create-bucket-configuration LocationConstraint="$AWS_REGION" 2>/dev/null || \
    aws s3api create-bucket \
        --bucket "$BUCKET_NAME" \
        --region "$AWS_REGION"
    echo -e "${GREEN}✓ Created bucket: $BUCKET_NAME${NC}"
fi

# Enable versioning
aws s3api put-bucket-versioning \
    --bucket "$BUCKET_NAME" \
    --versioning-configuration Status=Enabled
echo -e "${GREEN}✓ Enabled versioning on S3 bucket${NC}"

# Block public access
aws s3api put-public-access-block \
    --bucket "$BUCKET_NAME" \
    --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
echo -e "${GREEN}✓ Blocked public access on S3 bucket${NC}\n"

# Step 3: Create DynamoDB table for state locking
echo -e "${YELLOW}Step 3: Creating DynamoDB table for state locking...${NC}"
LOCK_TABLE="$APP_NAME-terraform-locks"
if aws dynamodb describe-table --table-name "$LOCK_TABLE" 2>/dev/null; then
    echo -e "${GREEN}✓ Table already exists: $LOCK_TABLE${NC}"
else
    aws dynamodb create-table \
        --table-name "$LOCK_TABLE" \
        --attribute-definitions AttributeName=LockID,AttributeType=S \
        --key-schema AttributeName=LockID,KeyType=HASH \
        --billing-mode PAY_PER_REQUEST \
        --region "$AWS_REGION"
    echo -e "${GREEN}✓ Created DynamoDB table: $LOCK_TABLE${NC}"
    
    # Wait for table to be created
    aws dynamodb wait table-exists --table-name "$LOCK_TABLE"
    echo -e "${GREEN}✓ Table is active and ready${NC}"
fi
echo

# Step 4: Create OIDC provider for GitHub Actions
echo -e "${YELLOW}Step 4: Setting up OIDC provider for GitHub Actions...${NC}"
OIDC_PROVIDER_ARN="arn:aws:iam::$ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"

if aws iam get-open-id-connect-provider --open-id-connect-provider-arn "$OIDC_PROVIDER_ARN" 2>/dev/null; then
    echo -e "${GREEN}✓ OIDC provider already exists${NC}"
else
    # Get thumbprint from GitHub
    THUMBPRINT=$(curl -s https://token.actions.githubusercontent.com/.well-known/openid-configuration \
        | jq -r '.issuer' | xargs -I {} curl -s "{}" | openssl x509 -fingerprint -noout | sed 's/://g' | awk '{print $NF}')
    
    aws iam create-open-id-connect-provider \
        --url https://token.actions.githubusercontent.com \
        --client-id-list sts.amazonaws.com \
        --thumbprint-list "$THUMBPRINT" \
        --region "$AWS_REGION"
    echo -e "${GREEN}✓ Created OIDC provider${NC}"
fi
echo

# Step 5: Create IAM role for GitHub Actions
echo -e "${YELLOW}Step 5: Creating IAM role for GitHub Actions...${NC}"
ROLE_NAME="GitHubActionsRecruiterReplyDeployer"

# Create trust policy
cat > /tmp/trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::$ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:$GITHUB_REPO:*"
        }
      }
    }
  ]
}
EOF

if aws iam get-role --role-name "$ROLE_NAME" 2>/dev/null; then
    echo -e "${GREEN}✓ Role already exists: $ROLE_NAME${NC}"
    # Update trust policy
    aws iam update-assume-role-policy-document \
        --role-name "$ROLE_NAME" \
        --policy-document file:///tmp/trust-policy.json
    echo -e "${GREEN}✓ Updated trust policy${NC}"
else
    aws iam create-role \
        --role-name "$ROLE_NAME" \
        --assume-role-policy-document file:///tmp/trust-policy.json
    echo -e "${GREEN}✓ Created IAM role: $ROLE_NAME${NC}"
fi
echo

# Step 6: Attach policies to role
echo -e "${YELLOW}Step 6: Attaching policies to IAM role...${NC}"

# Terraform backend policy
cat > /tmp/terraform-policy.json <<'EOF'
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
        "kms:*",
        "sts:GetCallerIdentity"
      ],
      "Resource": "*"
    }
  ]
}
EOF

aws iam put-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-name TerraformManagementPolicy \
    --policy-document file:///tmp/terraform-policy.json
echo -e "${GREEN}✓ Attached Terraform management policy${NC}"

# S3 and application policies
cat > /tmp/application-policy.json <<'EOF'
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
    }
  ]
}
EOF

aws iam put-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-name ApplicationDeploymentPolicy \
    --policy-document file:///tmp/application-policy.json
echo -e "${GREEN}✓ Attached application deployment policy${NC}\n"

# Step 7: Summary
echo -e "${BLUE}=== Setup Complete ===${NC}\n"
echo -e "${GREEN}✓ Infrastructure setup completed successfully!${NC}\n"

echo -e "${YELLOW}Next steps:${NC}"
echo "1. Add these secrets to your GitHub repository:"
echo "   Settings → Secrets and variables → Actions → Secrets"
echo ""
echo "   Required Secrets:"
echo "   - AWS_ROLE_TO_ASSUME = arn:aws:iam::$ACCOUNT_ID:role/$ROLE_NAME"
echo "   - TF_STATE_BUCKET = $BUCKET_NAME"
echo "   - TF_LOCK_TABLE = $LOCK_TABLE"
echo "   - AWS_REGION = $AWS_REGION"
echo ""
echo "2. Configure GitHub Environment Variables:"
echo "   Settings → Secrets and variables → Actions → Variables"
echo ""
echo "   Development environment:"
echo "   - S3_FRONTEND_BUCKET = recruiterreply-dev-frontend-$ACCOUNT_ID"
echo "   - EC2_DEPLOY_PATH = /home/ubuntu/recruiterreply"
echo ""
echo "3. Update Terraform environment files:"
echo "   infra/aws/terraform/environments/*.tfvars"
echo ""
echo "4. Create AWS Secrets for application:"
cat << 'SECRETS_CMD'
   
   aws secretsmanager create-secret \
     --name recruiterreply/dev \
     --description "RecruiterReply Development Secrets" \
     --secret-string '{"OPENAI_API_KEY":"sk-proj-YOUR_KEY","JWT_SECRET":"your-secret"}'
SECRETS_CMD
echo ""
echo "5. Deploy infrastructure:"
echo "   Push changes to GitHub to trigger infrastructure deployment"
echo "   git push origin dev"
echo ""
echo -e "${GREEN}Full documentation: docs/DEPLOYMENT_GUIDE.md${NC}"
echo -e "${GREEN}Checklist: docs/GITHUB_ACTIONS_SETUP.md${NC}\n"

# Cleanup
rm -f /tmp/trust-policy.json /tmp/terraform-policy.json /tmp/application-policy.json

echo -e "${BLUE}Setup script completed!${NC}\n"
