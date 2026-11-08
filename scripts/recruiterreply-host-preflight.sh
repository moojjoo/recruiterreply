#!/usr/bin/env bash
set -euo pipefail

# Read-only checks that must pass before a shared-EC2 deployment pulls or
# recreates a backend container. The caller owns the host-wide deployment lock.

ENVIRONMENT="${1:-}"
DEPLOY_PATH="${2:-.}"
COMPOSE_FILE="${3:-$DEPLOY_PATH/infra/aws/docker-compose.multi-env.yml}"
MAX_DISK_USED_PERCENT="${MAX_DISK_USED_PERCENT:-80}"
MIN_AVAILABLE_MEMORY_MB="${MIN_AVAILABLE_MEMORY_MB:-1024}"
MAX_LOAD_PER_CPU="${MAX_LOAD_PER_CPU:-0.90}"

case "$ENVIRONMENT" in
  dev|test|prod) ;;
  *) echo "Unsupported deployment environment: $ENVIRONMENT" >&2; exit 2 ;;
esac

TARGET_SERVICE="backend-$ENVIRONMENT"
IMAGE_VARIABLE="BACKEND_IMAGE_${ENVIRONMENT^^}"
DATABASE_NAME="recruiterreply_$ENVIRONMENT"
ENV_FILE="$DEPLOY_PATH/.env"

fail() { echo "HOST_PREFLIGHT_FAILED: $*" >&2; exit 1; }

[[ -f "$ENV_FILE" ]] || fail "missing environment file: $ENV_FILE"
[[ -f "$COMPOSE_FILE" ]] || fail "missing compose file: $COMPOSE_FILE"
command -v docker >/dev/null 2>&1 || fail "docker is not installed"
sudo docker info >/dev/null 2>&1 || fail "docker daemon is unavailable"

used_percent="$(df -Pk "$DEPLOY_PATH" | awk 'NR==2 {gsub(/%/, "", $5); print $5}')"
available_kb="$(df -Pk "$DEPLOY_PATH" | awk 'NR==2 {print $4}')"
[[ "$used_percent" =~ ^[0-9]+$ && "$available_kb" =~ ^[0-9]+$ ]] || fail "could not read filesystem capacity"
(( used_percent < MAX_DISK_USED_PERCENT )) || fail "disk usage ${used_percent}% is at or above ${MAX_DISK_USED_PERCENT}%"

available_memory_kb="$(awk '/^MemAvailable:/ {print $2; exit}' /proc/meminfo)"
[[ "$available_memory_kb" =~ ^[0-9]+$ ]] || fail "could not read available memory"
(( available_memory_kb >= MIN_AVAILABLE_MEMORY_MB * 1024 )) || fail "available memory is below ${MIN_AVAILABLE_MEMORY_MB} MiB"

load_per_cpu="$(awk -v cpus="$(getconf _NPROCESSORS_ONLN)" '{ if (cpus < 1) cpus = 1; printf "%.4f", $1 / cpus }' /proc/loadavg)"
awk -v measured_load_per_cpu="$load_per_cpu" -v limit="$MAX_LOAD_PER_CPU" 'BEGIN { exit !(measured_load_per_cpu < limit) }' || \
  fail "one-minute load per CPU ${load_per_cpu} is at or above ${MAX_LOAD_PER_CPU}"

# Compose config is read-only. The exact target service is checked so a caller
# cannot accidentally turn this preflight into a cross-environment operation.
sudo docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config --services >/tmp/recruiterreply-compose-services
grep -Fxq "$TARGET_SERVICE" /tmp/recruiterreply-compose-services || fail "compose file has no $TARGET_SERVICE service"
grep -Fxq postgres /tmp/recruiterreply-compose-services || fail "compose file has no shared postgres service"

grep -q "^${IMAGE_VARIABLE}=" "$ENV_FILE" || fail "missing ${IMAGE_VARIABLE} in $ENV_FILE"
grep -q "Database=${DATABASE_NAME}[;& ]" "$COMPOSE_FILE" || fail "compose database target mismatch for $ENVIRONMENT"

echo "HOST_PREFLIGHT_OK environment=$ENVIRONMENT service=$TARGET_SERVICE disk_used_percent=$used_percent available_memory_mb=$((available_memory_kb / 1024)) load_per_cpu=$load_per_cpu"
