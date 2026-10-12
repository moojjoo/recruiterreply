output "secret_arn" {
  value = data.aws_secretsmanager_secret.backend.arn
}

output "secret_name" {
  value = data.aws_secretsmanager_secret.backend.name
}
