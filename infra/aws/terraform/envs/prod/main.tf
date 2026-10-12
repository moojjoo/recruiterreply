# Shared-host deployment: prod runs as its own backend container and database
# on the EC2 host managed exclusively by envs/dev. This root intentionally
# manages NO compute, VPC, RDS, IAM, or Secrets Manager resources.
# The existing secret is resolved by metadata only, without reading its value.
# Do not add dedicated infrastructure without a separately approved migration.

data "aws_secretsmanager_secret" "backend" {
  name = "recruiterreply/prod/backend-app-secrets"
}
