#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="${PROJECT_NAME:-recruiterreply}"
ENV_NAME="${ENV_NAME:-dev}"
AWS_REGION="${AWS_REGION:-us-east-1}"

ECR_FRONTEND_REPO="${ECR_FRONTEND_REPO:-${PROJECT_NAME}-frontend}"
ECR_BACKEND_REPO="${ECR_BACKEND_REPO:-${PROJECT_NAME}-backend}"
EKS_CLUSTER_NAME="${EKS_CLUSTER_NAME:-${PROJECT_NAME}-${ENV_NAME}}"
OPENAI_SECRET_NAME="${OPENAI_SECRET_NAME:-${PROJECT_NAME}/${ENV_NAME}/openai-api-key}"

if ! command -v aws >/dev/null 2>&1; then
  echo "AWS CLI is not installed."
  exit 1
fi

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"

echo "Using AWS account: ${ACCOUNT_ID}"
echo "Using AWS region: ${AWS_REGION}"

create_ecr_repo() {
  local repo_name="$1"
  if aws ecr describe-repositories --repository-names "$repo_name" --region "$AWS_REGION" >/dev/null 2>&1; then
    echo "ECR repo exists: $repo_name"
  else
    echo "Creating ECR repo: $repo_name"
    aws ecr create-repository --repository-name "$repo_name" --region "$AWS_REGION" >/dev/null
  fi
}

if aws eks describe-cluster --name "$EKS_CLUSTER_NAME" --region "$AWS_REGION" >/dev/null 2>&1; then
  echo "EKS cluster exists: $EKS_CLUSTER_NAME"
else
  echo "EKS cluster not found: $EKS_CLUSTER_NAME"
  echo "Create it first, then rerun this script."
  echo "Example: eksctl create cluster --name $EKS_CLUSTER_NAME --region $AWS_REGION --nodes 2"
  exit 1
fi

create_ecr_repo "$ECR_FRONTEND_REPO"
create_ecr_repo "$ECR_BACKEND_REPO"

if aws secretsmanager describe-secret --secret-id "$OPENAI_SECRET_NAME" --region "$AWS_REGION" >/dev/null 2>&1; then
  echo "Secret exists: $OPENAI_SECRET_NAME"
else
  echo "Creating placeholder OpenAI secret: $OPENAI_SECRET_NAME"
  aws secretsmanager create-secret \
    --name "$OPENAI_SECRET_NAME" \
    --secret-string "REPLACE_WITH_REAL_OPENAI_KEY" \
    --region "$AWS_REGION" >/dev/null
fi

cat <<EOF

Bootstrap complete.

Created or verified:
- ECR: ${ECR_FRONTEND_REPO}
- ECR: ${ECR_BACKEND_REPO}
- EKS cluster: ${EKS_CLUSTER_NAME}
- Secrets Manager: ${OPENAI_SECRET_NAME}

Next:
1) Install AWS Load Balancer Controller on your EKS cluster.
2) Apply k8s resources in infra/k8s/dev and ensure backend secret exists.
3) Set GitHub repo secrets:
   - AWS_ROLE_TO_ASSUME
   - AWS_REGION (${AWS_REGION})
  - EKS_CLUSTER_NAME (${EKS_CLUSTER_NAME})
  - OPENAI_SECRET_ID (${OPENAI_SECRET_NAME})
4) Push to dev branch to trigger deployment workflow.

EOF
