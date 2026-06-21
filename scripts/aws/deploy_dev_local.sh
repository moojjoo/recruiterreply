#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

PROJECT_NAME="${PROJECT_NAME:-recruiterreply}"
ENV_NAME="${ENV_NAME:-dev}"
AWS_REGION="${AWS_REGION:-us-east-1}"
K8S_NAMESPACE="${K8S_NAMESPACE:-${PROJECT_NAME}-${ENV_NAME}}"
EKS_CLUSTER_NAME="${EKS_CLUSTER_NAME:-${PROJECT_NAME}-${ENV_NAME}}"

ECR_REPO_FRONTEND="${ECR_REPO_FRONTEND:-${PROJECT_NAME}-frontend}"
ECR_REPO_BACKEND="${ECR_REPO_BACKEND:-${PROJECT_NAME}-backend}"
OPENAI_SECRET_ID="${OPENAI_SECRET_ID:-${PROJECT_NAME}/${ENV_NAME}/openai-api-key}"

# Required secrets for backend and db-init job.
JWT_KEY="${JWT_KEY:-}"
DB_PASSWORD="${DB_PASSWORD:-}"

if git -C "$ROOT_DIR" rev-parse --verify HEAD >/dev/null 2>&1; then
  IMAGE_TAG_DEFAULT="$(git -C "$ROOT_DIR" rev-parse HEAD)"
else
  IMAGE_TAG_DEFAULT="local-$(date +%Y%m%d%H%M%S)"
fi
IMAGE_TAG="${IMAGE_TAG:-$IMAGE_TAG_DEFAULT}"

log() {
  echo "[$(date +%H:%M:%S)] $*"
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd" >&2
    exit 1
  fi
}

require_non_empty() {
  local name="$1"
  local value="$2"
  if [[ -z "$value" ]]; then
    echo "Required environment variable is missing: $name" >&2
    exit 1
  fi
}

ensure_ebs_csi_addon() {
  local status

  status="$(aws eks describe-addon --cluster-name "$EKS_CLUSTER_NAME" --region "$AWS_REGION" --addon-name aws-ebs-csi-driver --query 'addon.status' --output text 2>/dev/null || true)"

  if [[ -z "$status" ]]; then
    log "Installing EKS addon aws-ebs-csi-driver"
    aws eks create-addon \
      --cluster-name "$EKS_CLUSTER_NAME" \
      --region "$AWS_REGION" \
      --addon-name aws-ebs-csi-driver \
      --resolve-conflicts OVERWRITE >/dev/null
    status="CREATING"
  else
    log "EKS addon aws-ebs-csi-driver status: $status"
  fi

  local attempt=0
  while [[ "$status" != "ACTIVE" ]]; do
    attempt=$((attempt + 1))
    if (( attempt > 60 )); then
      echo "Timed out waiting for aws-ebs-csi-driver addon to become ACTIVE (last status: $status)" >&2
      exit 1
    fi
    sleep 5
    status="$(aws eks describe-addon --cluster-name "$EKS_CLUSTER_NAME" --region "$AWS_REGION" --addon-name aws-ebs-csi-driver --query 'addon.status' --output text)"
  done

  log "EKS addon aws-ebs-csi-driver is ACTIVE"
}

ensure_ecr_repo() {
  local repo_name="$1"
  if aws ecr describe-repositories --repository-names "$repo_name" --region "$AWS_REGION" >/dev/null 2>&1; then
    log "ECR repository exists: $repo_name"
  else
    log "Creating ECR repository: $repo_name"
    aws ecr create-repository --repository-name "$repo_name" --region "$AWS_REGION" >/dev/null
  fi
}

main() {
  require_cmd aws
  require_cmd docker
  require_cmd kubectl
  require_cmd git

  require_non_empty JWT_KEY "$JWT_KEY"
  require_non_empty DB_PASSWORD "$DB_PASSWORD"

  log "Validating AWS identity"
  ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
  REGISTRY="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

  log "Checking EKS cluster: $EKS_CLUSTER_NAME"
  aws eks describe-cluster --name "$EKS_CLUSTER_NAME" --region "$AWS_REGION" >/dev/null

  ensure_ebs_csi_addon
  ensure_ecr_repo "$ECR_REPO_FRONTEND"
  ensure_ecr_repo "$ECR_REPO_BACKEND"

  log "Updating kubeconfig"
  aws eks update-kubeconfig --name "$EKS_CLUSTER_NAME" --region "$AWS_REGION" >/dev/null

  log "Logging into ECR"
  aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$REGISTRY" >/dev/null

  log "Building and pushing frontend image tags: dev-latest, $IMAGE_TAG"
  docker build \
    --build-arg VITE_API_BASE_URL=/api \
    -t "$REGISTRY/$ECR_REPO_FRONTEND:dev-latest" \
    -t "$REGISTRY/$ECR_REPO_FRONTEND:$IMAGE_TAG" \
    "$ROOT_DIR/frontend"
  docker push "$REGISTRY/$ECR_REPO_FRONTEND:dev-latest"
  docker push "$REGISTRY/$ECR_REPO_FRONTEND:$IMAGE_TAG"

  log "Building and pushing backend image tags: dev-latest, $IMAGE_TAG"
  docker build \
    -t "$REGISTRY/$ECR_REPO_BACKEND:dev-latest" \
    -t "$REGISTRY/$ECR_REPO_BACKEND:$IMAGE_TAG" \
    "$ROOT_DIR/backend"
  docker push "$REGISTRY/$ECR_REPO_BACKEND:dev-latest"
  docker push "$REGISTRY/$ECR_REPO_BACKEND:$IMAGE_TAG"

  log "Reading OpenAI key from Secrets Manager: $OPENAI_SECRET_ID"
  OPENAI_KEY="$(aws secretsmanager get-secret-value --secret-id "$OPENAI_SECRET_ID" --region "$AWS_REGION" --query SecretString --output text)"

  CONNECTION_STRING="Host=recruiterreply-postgres;Port=5432;Database=recruiterreply_dev;Username=recruiterreply_dev;Password=$DB_PASSWORD"

  log "Ensuring namespace exists: $K8S_NAMESPACE"
  kubectl create namespace "$K8S_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f - >/dev/null

  log "Applying backend secret"
  kubectl -n "$K8S_NAMESPACE" create secret generic recruiterreply-backend-secrets \
    --from-literal=OpenAI__ApiKey="$OPENAI_KEY" \
    --from-literal=Jwt__Key="$JWT_KEY" \
    --from-literal=Postgres__Password="$DB_PASSWORD" \
    --from-literal=ConnectionStrings__DefaultConnection="$CONNECTION_STRING" \
    --dry-run=client -o yaml | kubectl apply -f - >/dev/null

  log "Applying Kubernetes manifests"
  kubectl apply -k "$ROOT_DIR/infra/k8s/dev"

  # If PVC was created previously without a storage class, it can remain unschedulable.
  existing_sc="$(kubectl -n "$K8S_NAMESPACE" get pvc postgres-data-recruiterreply-postgres-0 -o jsonpath='{.spec.storageClassName}' 2>/dev/null || true)"
  if [[ -z "$existing_sc" ]]; then
    log "Detected postgres PVC without storage class; recreating postgres stateful resources"
    kubectl -n "$K8S_NAMESPACE" delete statefulset recruiterreply-postgres --ignore-not-found=true
    kubectl -n "$K8S_NAMESPACE" delete pvc postgres-data-recruiterreply-postgres-0 --ignore-not-found=true
    kubectl apply -k "$ROOT_DIR/infra/k8s/dev"
  fi

  log "Waiting for postgres StatefulSet rollout"
  kubectl -n "$K8S_NAMESPACE" rollout status statefulset/recruiterreply-postgres --timeout=600s

  log "Running database init job"
  kubectl -n "$K8S_NAMESPACE" delete job recruiterreply-db-init --ignore-not-found=true
  kubectl apply -f "$ROOT_DIR/infra/k8s/dev/db-init-job.yaml"
  kubectl -n "$K8S_NAMESPACE" wait --for=condition=complete job/recruiterreply-db-init --timeout=600s

  log "Setting deployment images to commit tag: $IMAGE_TAG"
  kubectl -n "$K8S_NAMESPACE" set image deployment/recruiterreply-frontend frontend="$REGISTRY/$ECR_REPO_FRONTEND:$IMAGE_TAG"
  kubectl -n "$K8S_NAMESPACE" set image deployment/recruiterreply-backend backend="$REGISTRY/$ECR_REPO_BACKEND:$IMAGE_TAG"

  log "Waiting for frontend rollout"
  kubectl -n "$K8S_NAMESPACE" rollout status deployment/recruiterreply-frontend --timeout=600s
  log "Waiting for backend rollout"
  kubectl -n "$K8S_NAMESPACE" rollout status deployment/recruiterreply-backend --timeout=600s

  echo
  log "Deployment complete"
  echo "Cluster:    $EKS_CLUSTER_NAME"
  echo "Namespace:  $K8S_NAMESPACE"
  echo "Image tag:  $IMAGE_TAG"
  echo
  kubectl -n "$K8S_NAMESPACE" get statefulset,job,deploy,svc,ingress,pods
}

main "$@"
