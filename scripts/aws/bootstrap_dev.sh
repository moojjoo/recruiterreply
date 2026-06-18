#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="${PROJECT_NAME:-recruiterreply}"
ENV_NAME="${ENV_NAME:-dev}"
AWS_REGION="${AWS_REGION:-us-east-1}"

ECR_FRONTEND_REPO="${ECR_FRONTEND_REPO:-${PROJECT_NAME}-frontend}"
ECR_BACKEND_REPO="${ECR_BACKEND_REPO:-${PROJECT_NAME}-backend}"
ECS_CLUSTER_NAME="${ECS_CLUSTER_NAME:-${PROJECT_NAME}-${ENV_NAME}}"
LOG_GROUP_FRONTEND="${LOG_GROUP_FRONTEND:-/ecs/${PROJECT_NAME}-${ENV_NAME}-frontend}"
LOG_GROUP_BACKEND="${LOG_GROUP_BACKEND:-/ecs/${PROJECT_NAME}-${ENV_NAME}-backend}"
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

create_log_group() {
  local group_name="$1"
  if aws logs describe-log-groups --log-group-name-prefix "$group_name" --region "$AWS_REGION" --query 'logGroups[?logGroupName==`'"$group_name"'`].logGroupName' --output text | grep -q "$group_name"; then
    echo "Log group exists: $group_name"
  else
    echo "Creating log group: $group_name"
    aws logs create-log-group --log-group-name "$group_name" --region "$AWS_REGION"
  fi
}

if aws ecs describe-clusters --clusters "$ECS_CLUSTER_NAME" --region "$AWS_REGION" --query 'clusters[0].status' --output text 2>/dev/null | grep -q ACTIVE; then
  echo "ECS cluster exists: $ECS_CLUSTER_NAME"
else
  echo "Creating ECS cluster: $ECS_CLUSTER_NAME"
  aws ecs create-cluster --cluster-name "$ECS_CLUSTER_NAME" --region "$AWS_REGION" >/dev/null
fi

create_ecr_repo "$ECR_FRONTEND_REPO"
create_ecr_repo "$ECR_BACKEND_REPO"
create_log_group "$LOG_GROUP_FRONTEND"
create_log_group "$LOG_GROUP_BACKEND"

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
- ECS cluster: ${ECS_CLUSTER_NAME}
- CloudWatch logs: ${LOG_GROUP_FRONTEND}, ${LOG_GROUP_BACKEND}
- Secrets Manager: ${OPENAI_SECRET_NAME}

Next:
1) Create ECS task execution role and task role if not already present.
2) Create ECS services (frontend + backend) using images tagged as dev-latest.
3) Set GitHub repo secrets:
   - AWS_ROLE_TO_ASSUME
   - AWS_REGION (${AWS_REGION})
   - ECS_CLUSTER (${ECS_CLUSTER_NAME})
   - ECS_FRONTEND_SERVICE
   - ECS_BACKEND_SERVICE
4) Push to dev branch to trigger deployment workflow.

EOF
