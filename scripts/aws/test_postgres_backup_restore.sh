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

bucket="${BACKUP_BUCKET:-recruiterreply-postgres-backups-$(aws sts get-caller-identity --query Account --output text)}"
object_key="$(aws s3api list-objects-v2 \
  --bucket "$bucket" \
  --prefix "${environment}/" \
  --query 'reverse(Contents[].Key)[0]' \
  --output text)"

case "$object_key" in
  "${environment}/recruiterreply/"*.dump|"${environment}/recruiterreply_${environment}/"*.dump) ;;
  *) echo "No valid backup found for $environment." >&2; exit 1 ;;
esac
if [[ -z "$object_key" || "$object_key" == "None" ]]; then
  echo "No valid backup found for $environment." >&2
  exit 1
fi

tmpfs_size="${BACKUP_RESTORE_TMPFS_SIZE:-1g}"
if [[ ! "$tmpfs_size" =~ ^[0-9]+[kKmMgG]?$ ]]; then
  echo "BACKUP_RESTORE_TMPFS_SIZE must be a size such as 1g or 512m." >&2
  exit 2
fi

container="recruiterreply-restore-${environment}-$(date -u +%s)-$$"
container_created=false
cleanup() {
  if [[ "$container_created" == true ]]; then
    docker rm --force "$container" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

docker run --rm --detach \
  --name "$container" \
  --network none \
  --tmpfs "/var/lib/postgresql/data:rw,nosuid,nodev,noexec,size=${tmpfs_size}" \
  --env POSTGRES_USER=restore \
  --env POSTGRES_PASSWORD=restore-only-temporary \
  --env POSTGRES_DB=restore \
  postgres:16-alpine >/dev/null
container_created=true

ready=false
for _ in $(seq 1 30); do
  if docker exec "$container" pg_isready --username restore --dbname restore >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 2
done

if [[ "$ready" != true ]]; then
  echo "Isolated PostgreSQL restore database did not become ready." >&2
  exit 1
fi

aws s3 cp "s3://${bucket}/${object_key}" - --only-show-errors |
  docker exec --interactive "$container" pg_restore \
    --exit-on-error \
    --no-owner \
    --no-acl \
    --username restore \
    --dbname restore

restored_database="$(docker exec "$container" psql --username restore --dbname restore --tuples-only --no-align --command 'SELECT current_database()')"
table_count="$(docker exec "$container" psql --username restore --dbname restore --tuples-only --no-align --command "SELECT count(*) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema')")"
if [[ "$restored_database" != "restore" || ! "$table_count" =~ ^[0-9]+$ || "$table_count" -eq 0 ]]; then
  echo "Restored database verification failed." >&2
  exit 1
fi

echo "Restore verified in isolated, temporary database from s3://${bucket}/${object_key} (${table_count} tables)."
