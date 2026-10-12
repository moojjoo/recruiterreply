# Look up the existing backend secret metadata only.
# Terraform does not create or read secret values.
# Runtime access is managed by the existing shared EC2 IAM role policies.
data "aws_secretsmanager_secret" "backend" {
  name = var.backend_secret_name
}
