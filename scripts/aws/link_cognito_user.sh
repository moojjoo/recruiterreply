#!/usr/bin/env bash
set -euo pipefail

# One-time operator linking for an approved Cognito user and an existing
# RecruiterReply PostgreSQL user. Dry-run is the default.

usage() {
  cat <<'EOF'
Usage: link_cognito_user.sh --pool-id ID --cognito-username USERNAME \
  --postgres-email EMAIL --instance-id INSTANCE [--environment dev|test] \
  [--deploy-path PATH] [--apply]
EOF
}

POOL_ID=""
COGNITO_USERNAME=""
POSTGRES_EMAIL=""
INSTANCE_ID=""
ENVIRONMENT="dev"
DEPLOY_PATH="/home/ubuntu/recruiterreply"
APPLY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --pool-id) POOL_ID="${2:?missing value for --pool-id}"; shift 2 ;;
    --cognito-username) COGNITO_USERNAME="${2:?missing value for --cognito-username}"; shift 2 ;;
    --postgres-email) POSTGRES_EMAIL="${2:?missing value for --postgres-email}"; shift 2 ;;
    --instance-id) INSTANCE_ID="${2:?missing value for --instance-id}"; shift 2 ;;
    --environment) ENVIRONMENT="${2:?missing value for --environment}"; shift 2 ;;
    --deploy-path) DEPLOY_PATH="${2:?missing value for --deploy-path}"; shift 2 ;;
    --apply) APPLY=true; shift ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

for command in aws jq base64 gzip; do
  command -v "$command" >/dev/null 2>&1 || { echo "Missing required command: $command" >&2; exit 2; }
done
[[ "$ENVIRONMENT" == "dev" || "$ENVIRONMENT" == "test" ]] || {
  echo "Only dev and test are allowed; production linking is forbidden." >&2; exit 2;
}
[[ -n "$POOL_ID" && -n "$COGNITO_USERNAME" && -n "$POSTGRES_EMAIL" && -n "$INSTANCE_ID" ]] || {
  usage >&2; exit 2;
}

USER_JSON="$(aws cognito-idp admin-get-user --user-pool-id "$POOL_ID" --username "$COGNITO_USERNAME" --output json)"
COGNITO_EMAIL="$(jq -r '.UserAttributes[]? | select(.Name == "email") | .Value' <<<"$USER_JSON" | head -n1)"
EMAIL_VERIFIED="$(jq -r '.UserAttributes[]? | select(.Name == "email_verified") | .Value' <<<"$USER_JSON" | head -n1)"
COGNITO_SUB="$(jq -r '.UserAttributes[]? | select(.Name == "sub") | .Value' <<<"$USER_JSON" | head -n1)"

normalize_email() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed 's/[[:space:]]//g'; }
sql_escape() { local value="$1"; value="${value//\\/\\\\}"; value="${value//\'/\'\'}"; printf '%s' "$value"; }

[[ "$EMAIL_VERIFIED" == "true" ]] || { echo "Refusing link: Cognito email_verified is not true." >&2; exit 1; }
[[ -n "$COGNITO_EMAIL" && -n "$COGNITO_SUB" ]] || { echo "Refusing link: Cognito email or sub is missing." >&2; exit 1; }
[[ "$(normalize_email "$COGNITO_EMAIL")" == "$(normalize_email "$POSTGRES_EMAIL")" ]] || {
  echo "Refusing link: Cognito and PostgreSQL emails do not match." >&2; exit 1;
}

EMAIL_SQL="$(sql_escape "$(normalize_email "$POSTGRES_EMAIL")")"
SUB_SQL="$(sql_escape "$COGNITO_SUB")"
SQL="$(cat <<EOF
BEGIN;
DO \\\$\\$
DECLARE target_id uuid; target_provider text; target_provider_id text; subject_owner uuid;
BEGIN
  SELECT id, auth_provider, provider_user_id INTO target_id, target_provider, target_provider_id
    FROM users WHERE lower(email) = '$EMAIL_SQL' AND is_active = true FOR UPDATE;
  IF target_id IS NULL THEN RAISE EXCEPTION 'No active PostgreSQL user matches the approved email'; END IF;
  SELECT id INTO subject_owner FROM users WHERE auth_provider = 'cognito' AND provider_user_id = '$SUB_SQL' FOR UPDATE;
  IF subject_owner IS NOT NULL AND subject_owner <> target_id THEN RAISE EXCEPTION 'Cognito subject is already linked to another PostgreSQL user'; END IF;
  IF target_provider_id IS NOT NULL AND target_provider_id <> '' AND NOT (target_provider = 'cognito' AND target_provider_id = '$SUB_SQL') THEN
    RAISE EXCEPTION 'Target PostgreSQL user is already linked to another provider identity';
  END IF;
  UPDATE users SET auth_provider = 'cognito', provider_user_id = '$SUB_SQL', updated_at = CURRENT_TIMESTAMP WHERE id = target_id;
  RAISE NOTICE 'COGNITO_LINK result=success user_id=% environment=$ENVIRONMENT', target_id;
END \\\$\\$;
COMMIT;
EOF
)"
SQL_B64="$(printf '%s' "$SQL" | gzip -c | base64 -w0)"
COMMANDS_JSON="$(jq -n --arg db "recruiterreply_$ENVIRONMENT" --arg sql "$SQL_B64" --arg deploy_path "$DEPLOY_PATH" '{commands:["set -eu",("cd " + ($deploy_path|@sh) + "; PGU=$(sudo grep ^POSTGRES_SUPERUSER= .env 2>/dev/null | cut -d= -f2); PGU=${PGU:-postgres}; echo " + ($sql|@sh) + " | base64 -d | gunzip | sudo docker exec -i recruiterreply-postgres psql -U $PGU -d " + $db + " -v ON_ERROR_STOP=1 -q")]}')"

echo "Verified Cognito identity and exact email match."
echo "Environment: $ENVIRONMENT"
echo "Cognito subject prefix: ${COGNITO_SUB:0:8}..."
echo "Mode: $([[ "$APPLY" == true ]] && echo apply || echo dry-run)"
[[ "$APPLY" == true ]] || { echo "Dry-run only; rerun with --apply after review."; exit 0; }

COMMAND_ID="$(aws ssm send-command --instance-ids "$INSTANCE_ID" --document-name AWS-RunShellScript --comment "One-time Cognito link ($ENVIRONMENT)" --parameters "$COMMANDS_JSON" --query 'Command.CommandId' --output text)"
aws ssm wait command-executed --command-id "$COMMAND_ID" --instance-id "$INSTANCE_ID"
aws ssm get-command-invocation --command-id "$COMMAND_ID" --instance-id "$INSTANCE_ID" --query '{status:Status,output:StandardOutputContent,error:StandardErrorContent}' --output json
