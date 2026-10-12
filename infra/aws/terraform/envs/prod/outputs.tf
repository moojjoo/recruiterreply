# These are metadata outputs only; the shared EC2 host belongs to envs/dev.
# Environment-specific PostgreSQL databases are managed at the application/
# Docker level, not as dedicated RDS instances in this Terraform root.
output "backend_secret_arn" {
  description = "ARN of the existing prod backend secret (metadata only)."
  value       = data.aws_secretsmanager_secret.backend.arn
}

output "backend_secret_name" {
  description = "Name of the existing prod backend secret."
  value       = data.aws_secretsmanager_secret.backend.name
}
