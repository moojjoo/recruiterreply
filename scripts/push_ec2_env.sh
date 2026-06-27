#!/usr/bin/env bash
set -euo pipefail

INSTANCE_ID="${1:-i-0dbe396e361ea6d56}"
DEPLOY_PATH="${2:-/home/ubuntu/recruiterreply}"
TARGET_SERVICE="${3:-backend-dev}"

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI is required"
  exit 1
fi

if ! command -v base64 >/dev/null 2>&1; then
  echo "base64 is required"
  exit 1
fi

read -r -p "POSTGRES_SUPERUSER [postgres]: " POSTGRES_SUPERUSER
POSTGRES_SUPERUSER="${POSTGRES_SUPERUSER:-postgres}"

read -r -s -p "POSTGRES_SUPERPASS: " POSTGRES_SUPERPASS
echo
read -r -s -p "OPENAI_API_KEY: " OPENAI_API_KEY
echo
read -r -s -p "JWT_KEY_DEV (min 32 chars): " JWT_KEY_DEV
echo
read -r -s -p "JWT_KEY_TEST (min 32 chars): " JWT_KEY_TEST
echo
read -r -s -p "JWT_KEY_PROD (min 32 chars): " JWT_KEY_PROD
echo

if [[ -z "$POSTGRES_SUPERPASS" || -z "$OPENAI_API_KEY" ]]; then
  echo "POSTGRES_SUPERPASS and OPENAI_API_KEY are required"
  exit 1
fi

tmp_env="$(mktemp)"
tmp_json="$(mktemp)"
cleanup() {
  rm -f "$tmp_env" "$tmp_json"
}
trap cleanup EXIT

cat >"$tmp_env" <<EOF
POSTGRES_SUPERUSER=${POSTGRES_SUPERUSER}
POSTGRES_SUPERPASS=${POSTGRES_SUPERPASS}

OPENAI_API_KEY=${OPENAI_API_KEY}

JWT_KEY_DEV=${JWT_KEY_DEV}
JWT_KEY_TEST=${JWT_KEY_TEST}
JWT_KEY_PROD=${JWT_KEY_PROD}
EOF

ENV_B64="$(base64 -w0 "$tmp_env")"

cat >"$tmp_json" <<EOF
{
  "commands": [
    "set -eu",
    "sudo install -d -m 755 ${DEPLOY_PATH}",
    "touch ${DEPLOY_PATH}/.env",
    "echo '${ENV_B64}' | base64 -d | sudo tee /tmp/recruiterreply-env-update >/dev/null",
    "while IFS= read -r line; do key=\$(printf '%s' \"\$line\" | cut -d= -f1); if [ -z \"\$key\" ]; then continue; fi; if sudo grep -q \"^\${key}=\" ${DEPLOY_PATH}/.env; then sudo sed -i \"s|^\${key}=.*|\$line|\" ${DEPLOY_PATH}/.env; else echo \"\$line\" | sudo tee -a ${DEPLOY_PATH}/.env >/dev/null; fi; done < /tmp/recruiterreply-env-update",
    "sudo rm -f /tmp/recruiterreply-env-update",
    "sudo chown ubuntu:ubuntu ${DEPLOY_PATH}/.env",
    "sudo chmod 600 ${DEPLOY_PATH}/.env",
    "cd ${DEPLOY_PATH}",
    "if ! command -v docker >/dev/null 2>&1; then sudo apt-get update && sudo apt-get install -y docker.io docker-compose-v2 && sudo systemctl enable --now docker; fi",
    "if [ \"${TARGET_SERVICE}\" = \"backend-dev\" ]; then IMAGE_VAR=BACKEND_IMAGE_DEV; elif [ \"${TARGET_SERVICE}\" = \"backend-test\" ]; then IMAGE_VAR=BACKEND_IMAGE_TEST; else IMAGE_VAR=BACKEND_IMAGE_PROD; fi",
    "TARGET_IMAGE=\$(grep \"^\${IMAGE_VAR}=\" .env | cut -d= -f2- || true)",
    "sudo docker compose --env-file .env -f infra/aws/docker-compose.multi-env.yml up -d postgres",
    "if [ -n \"\$TARGET_IMAGE\" ] && sudo docker image inspect \"\$TARGET_IMAGE\" >/dev/null 2>&1; then sudo docker compose --env-file .env -f infra/aws/docker-compose.multi-env.yml up -d ${TARGET_SERVICE}; else echo \"Skipping ${TARGET_SERVICE}: image '\$TARGET_IMAGE' not present locally. Run deploy workflow to load/pull image.\"; fi"
  ]
}
EOF

echo "Sending secure env update to ${INSTANCE_ID}..."
command_id="$(AWS_PAGER="" aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --comment "Update recruiterreply runtime .env and restart compose" \
  --parameters "file://$tmp_json" \
  --query 'Command.CommandId' \
  --output text)"

echo "Command ID: $command_id"
if ! AWS_PAGER="" aws ssm wait command-executed --command-id "$command_id" --instance-id "$INSTANCE_ID"; then
  echo "SSM command failed. Invocation output:"
  AWS_PAGER="" aws ssm get-command-invocation \
    --command-id "$command_id" \
    --instance-id "$INSTANCE_ID" \
    --query '{Status:Status,ResponseCode:ResponseCode,StdOut:StandardOutputContent,StdErr:StandardErrorContent}' \
    --output json
  exit 1
fi

AWS_PAGER="" aws ssm get-command-invocation \
  --command-id "$command_id" \
  --instance-id "$INSTANCE_ID" \
  --query '{Status:Status,StdOut:StandardOutputContent,StdErr:StandardErrorContent}' \
  --output json