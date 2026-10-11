#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <dev|test|prod> <aws-region>" >&2
  exit 2
fi

environment="$1"
region="$2"
case "$environment" in
  dev|test|prod) ;;
  *) echo "Environment must be dev, test, or prod." >&2; exit 2 ;;
esac
if [[ ! "$region" =~ ^[a-z]{2}(-[a-z]+)+-[0-9]+$ ]]; then
  echo "Invalid AWS region." >&2
  exit 2
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
install_dir="/usr/local/libexec/recruiterreply"
install -d -m 0755 "$install_dir"
install -m 0755 "$script_dir/backup_postgres.sh" "$install_dir/backup_postgres.sh"
install -m 0755 "$script_dir/test_postgres_backup_restore.sh" "$install_dir/test_postgres_backup_restore.sh"

cat > /etc/systemd/system/recruiterreply-postgres-backup@.service <<EOF
[Unit]
Description=Create encrypted PostgreSQL backup for %i
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
Environment=AWS_REGION=${region}
Environment=AWS_DEFAULT_REGION=${region}
ExecStart=${install_dir}/backup_postgres.sh %i
EOF

cat > /etc/systemd/system/recruiterreply-postgres-backup@.timer <<'EOF'
[Unit]
Description=Daily PostgreSQL backup for %i

[Timer]
OnCalendar=*-*-* 02:00:00 UTC
Persistent=true
Unit=recruiterreply-postgres-backup@%i.service

[Install]
WantedBy=timers.target
EOF

cat > /etc/systemd/system/recruiterreply-postgres-restore-test@.service <<EOF
[Unit]
Description=Verify isolated PostgreSQL restore for %i
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
Environment=AWS_REGION=${region}
Environment=AWS_DEFAULT_REGION=${region}
ExecStart=${install_dir}/test_postgres_backup_restore.sh %i
EOF

cat > /etc/systemd/system/recruiterreply-postgres-restore-test@.timer <<'EOF'
[Unit]
Description=Monthly isolated PostgreSQL restore test for %i

[Timer]
OnCalendar=*-*-01 03:00:00 UTC
Persistent=true
Unit=recruiterreply-postgres-restore-test@%i.service

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now "recruiterreply-postgres-backup@${environment}.timer"
systemctl enable --now "recruiterreply-postgres-restore-test@${environment}.timer"
