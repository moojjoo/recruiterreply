#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <dev|test|prod>" >&2
  exit 2
fi

environment="$1"
case "$environment" in
  dev|test|prod) ;;
  *) echo "Environment must be dev, test, or prod." >&2; exit 2 ;;
esac

export BACKUP_ENVIRONMENT="$environment"
bucket="${BACKUP_BUCKET:-recruiterreply-postgres-backups-$(aws sts get-caller-identity --query Account --output text)}"
container="recruiterreply-backend-${environment}"
network="${POSTGRES_NETWORK:-recruiterreply}"
secret_name="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$container" |
  sed -n 's/^AWS_SECRETS_MANAGER_SECRET_NAME=//p' | head -n 1)"
if [[ -z "$secret_name" ]]; then
  echo "Could not find the backend's AWS Secrets Manager secret name." >&2
  exit 1
fi
case "$secret_name" in
  *"/${environment}/"*|*"-${environment}-"*) ;;
  *) echo "Backend secret name does not identify environment $environment." >&2; exit 1 ;;
esac

secret_json="$(aws secretsmanager get-secret-value \
  --secret-id "$secret_name" \
  --query SecretString \
  --output text)"
umask 077
settings_file="$(mktemp "${TMPDIR:-/tmp}/recruiterreply-db-XXXXXX")"
pgpass_file="$(mktemp "${TMPDIR:-/tmp}/recruiterreply-pgpass-XXXXXX")"
dump_file="$(mktemp "${TMPDIR:-/tmp}/recruiterreply-${environment}-XXXXXX.dump")"
cleanup() {
  rm -f "$settings_file" "$pgpass_file" "$dump_file"
}
trap cleanup EXIT

python3 -c '
import json
import os
import sys

def connection_value(secret):
    for key in ("ConnectionStrings", "ConnectionStrings:DefaultConnection"):
        value = secret.get(key)
        if key == "ConnectionStrings" and isinstance(value, dict):
            value = value.get("DefaultConnection")
        if isinstance(value, str) and value:
            return value
    raise ValueError("DefaultConnection was not found in the backend secret")

def parse_connection_string(value):
    parts = []
    current = []
    quote = None
    index = 0
    while index < len(value):
        char = value[index]
        if quote and char == quote:
            if index + 1 < len(value) and value[index + 1] == quote:
                current.append(char)
                index += 2
                continue
            quote = None
        elif char in ("\"", "\x27") and quote is None:
            value_part = "".join(current).rsplit("=", 1)[-1]
            if "=" in "".join(current) and not value_part.strip():
                quote = char
            else:
                current.append(char)
        elif char == ";" and quote is None:
            parts.append("".join(current))
            current = []
        else:
            current.append(char)
        index += 1
    if quote:
        raise ValueError("Unterminated quoted connection-string value")
    parts.append("".join(current))
    parsed = {}
    for part in parts:
        if not part.strip():
            continue
        key, separator, item = part.partition("=")
        if not separator:
            raise ValueError("Invalid connection-string setting")
        parsed[key.strip().casefold()] = item.strip()
    aliases = {
        "host": ("host", "server", "address", "addr", "network address"),
        "port": ("port",),
        "database": ("database", "initial catalog"),
        "user": ("username", "user id", "userid", "user"),
        "password": ("password", "pwd"),
        "sslmode": ("ssl mode", "sslmode"),
    }
    result = {}
    for target, keys in aliases.items():
        result[target] = next((parsed[key] for key in keys if parsed.get(key)), "")
    result["port"] = result["port"] or "5432"
    result["sslmode"] = (result["sslmode"] or "prefer").casefold()
    required = ("host", "database", "user", "password")
    if any(not result[key] for key in required):
        raise ValueError("Connection string is missing a required PostgreSQL setting")
    if ":" in result["host"] or "\n" in result["host"] or "\r" in result["host"]:
        raise ValueError("Unsupported PostgreSQL host value")
    if not result["port"].isdigit() or not 1 <= int(result["port"]) <= 65535:
        raise ValueError("Invalid PostgreSQL port")
    if result["sslmode"] not in ("disable", "allow", "prefer", "require", "verify-ca", "verify-full"):
        raise ValueError("Invalid PostgreSQL SSL mode")
    return result

secret = json.load(sys.stdin)
settings = parse_connection_string(connection_value(secret))
if settings["database"] not in ("recruiterreply", "recruiterreply_" + os.environ["BACKUP_ENVIRONMENT"]):
    raise ValueError("Database name does not match the selected environment")
if settings["host"] != "postgres" and "-" + os.environ["BACKUP_ENVIRONMENT"] + "-postgres." not in settings["host"]:
    raise ValueError("Database endpoint does not match the selected environment")
passfile = sys.argv[1]
with open(passfile, "w", encoding="utf-8") as file:
    host, port, database, user = (settings[key] for key in ("host", "port", "database", "user"))
    fields = (host, port, database, user, settings["password"])
    file.write(":".join(value.replace("\\", "\\\\").replace(":", "\\:") for value in fields) + "\n")
os.chmod(passfile, 0o600)
for key in ("host", "port", "database", "user", "sslmode"):
    sys.stdout.buffer.write(settings[key].encode() + b"\0")
' "$pgpass_file" <<<"$secret_json" >"$settings_file"
unset secret_json

mapfile -d '' -t settings < "$settings_file"
if [[ ${#settings[@]} -ne 5 ]]; then
  echo "Could not parse the backend PostgreSQL connection settings." >&2
  exit 1
fi
db_host="${settings[0]}"
db_port="${settings[1]}"
db_name="${settings[2]}"
db_user="${settings[3]}"
ssl_mode="${settings[4]}"

if ! docker run --rm --network "$network" \
  --mount "type=bind,source=${pgpass_file},target=/root/.pgpass,readonly" \
  --env "PGSSLMODE=${ssl_mode}" \
  postgres:16-alpine pg_isready \
  --host "$db_host" --port "$db_port" --username "$db_user" --dbname "$db_name" >/dev/null; then
  echo "Database for $environment is not ready." >&2
  exit 1
fi

object_key="${environment}/${db_name}/$(date -u +%Y%m%dT%H%M%SZ)-$$.dump"
if ! docker run --rm --network "$network" \
  --mount "type=bind,source=${pgpass_file},target=/root/.pgpass,readonly" \
  --env "PGSSLMODE=${ssl_mode}" \
  postgres:16-alpine pg_dump \
  --no-password \
  --host "$db_host" \
  --port "$db_port" \
  --username "$db_user" \
  --dbname "$db_name" \
  --format=custom \
  --no-owner \
  --no-acl >"$dump_file"; then
  echo "PostgreSQL dump failed for $environment." >&2
  exit 1
fi

if ! docker run --rm --network none \
  --mount "type=bind,source=${dump_file},target=/tmp/backup.dump,readonly" \
  postgres:16-alpine pg_restore --list /tmp/backup.dump >/dev/null; then
  echo "PostgreSQL dump validation failed for $environment." >&2
  exit 1
fi

if ! aws s3 cp "$dump_file" "s3://${bucket}/${object_key}" --sse AES256 --only-show-errors; then
  echo "PostgreSQL backup upload failed for $environment." >&2
  exit 1
fi

backup_size="$(aws s3api head-object --bucket "$bucket" --key "$object_key" --query ContentLength --output text)"
if [[ ! "$backup_size" =~ ^[1-9][0-9]*$ ]]; then
  echo "Uploaded PostgreSQL backup is empty or could not be verified." >&2
  exit 1
fi
echo "Encrypted PostgreSQL backup uploaded: s3://${bucket}/${object_key}"
