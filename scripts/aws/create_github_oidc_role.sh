#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 3 ]]; then
  echo "Usage: $0 <github-owner> <github-repo> <aws-region> [role-name]"
  echo "Example: $0 moojjoo recruiterreply us-east-1 recruiterreply-github-actions-role"
  exit 1
fi

GITHUB_OWNER="$1"
GITHUB_REPO="$2"
AWS_REGION="$3"
ROLE_NAME="${4:-recruiterreply-github-actions-role}"

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
OIDC_PROVIDER_ARN="arn:aws:iam::${ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"

if aws iam get-open-id-connect-provider --open-id-connect-provider-arn "$OIDC_PROVIDER_ARN" >/dev/null 2>&1; then
  echo "OIDC provider already exists: $OIDC_PROVIDER_ARN"
else
  echo "Creating GitHub OIDC provider"
  aws iam create-open-id-connect-provider \
    --url https://token.actions.githubusercontent.com \
    --client-id-list sts.amazonaws.com \
    --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 >/dev/null
fi

TRUST_POLICY_FILE="$(mktemp)"
PERMISSION_POLICY_FILE="$(mktemp)"

cat > "$TRUST_POLICY_FILE" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "${OIDC_PROVIDER_ARN}"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:${GITHUB_OWNER}/${GITHUB_REPO}:*"
        }
      }
    }
  ]
}
EOF

cat > "$PERMISSION_POLICY_FILE" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EcrPushPull",
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:PutImage",
        "ecr:BatchGetImage",
        "ecr:DescribeRepositories"
      ],
      "Resource": "*"
    },
    {
      "Sid": "EksAccess",
      "Effect": "Allow",
      "Action": [
        "eks:DescribeCluster"
      ],
      "Resource": "*"
    },
    {
      "Sid": "ReadSecretsManager",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": "*"
    },
    {
      "Sid": "PassRole",
      "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": "*"
    }
  ]
}
EOF

if aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  echo "IAM role exists: $ROLE_NAME"
else
  echo "Creating IAM role: $ROLE_NAME"
  aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document "file://${TRUST_POLICY_FILE}" >/dev/null
fi

echo "Attaching/Updating inline policy"
aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name "RecruiterReplyGithubActionsDeployPolicy" \
  --policy-document "file://${PERMISSION_POLICY_FILE}" >/dev/null

ROLE_ARN="$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)"

rm -f "$TRUST_POLICY_FILE" "$PERMISSION_POLICY_FILE"

cat <<EOF

GitHub OIDC role is ready.

Use this in GitHub secret AWS_ROLE_TO_ASSUME:
${ROLE_ARN}

Also set GitHub secrets:
- AWS_REGION=${AWS_REGION}
- EKS_CLUSTER_NAME=<your EKS cluster name>
- OPENAI_SECRET_ID=<your Secrets Manager secret id>

Important:
- Map this role in EKS access so kubectl apply is allowed from CI.
- Create an EKS access entry and associate AmazonEKSClusterAdminPolicy for bootstrap,
  or bind this role to a limited RBAC group for least privilege.

EOF
