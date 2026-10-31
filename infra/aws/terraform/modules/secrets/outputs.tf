output "secret_arn" {
  value = data.aws_secretsmanager_secret.backend.arn
}

output "secret_name" {
  value = data.aws_secretsmanager_secret.backend.name
}

output "backend_secret_arn" {
  value       = data.aws_secretsmanager_secret.backend.arn
  description = "ARN of the existing backend secret used by the runtime."
}
