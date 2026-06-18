#!/usr/bin/env bash
set -euo pipefail

DB_NAME="${DB_NAME:-recruiterreply_dev}"
DB_USER="${DB_USER:-recruiterreply_dev}"
DB_PASS="${DB_PASS:-change_this_password}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Creating role and database if needed..."
sudo -u postgres psql <<SQL
DO
\$\$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${DB_USER}') THEN
      CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';
   END IF;
END
\$\$;
SQL

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" | grep -q 1 || sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"

echo "Applying schema from init_postgres.sql..."
PGPASSWORD="${DB_PASS}" psql -h localhost -U "${DB_USER}" -d "${DB_NAME}" -f "${SCRIPT_DIR}/init_postgres.sql"

echo "Done."
echo "Connection string: Host=localhost;Port=5432;Database=${DB_NAME};Username=${DB_USER};Password=${DB_PASS}"
