output "github_actions_role_arn" {
  description = "ARN of the IAM role GitHub Actions assumes via OIDC to deploy."
  value       = module.github_oidc.role_arn
}

output "frontend_buckets" {
  description = "Frontend S3 buckets keyed by environment label."
  value       = module.frontend.bucket_names
}

output "cloudfront_distribution_ids" {
  description = "CloudFront distribution IDs keyed by environment label."
  value       = module.frontend.cloudfront_distribution_ids
}

output "cloudfront_domain_names" {
  description = "CloudFront domain names keyed by environment label."
  value       = module.frontend.cloudfront_domain_names
}

output "postgres_backup_bucket_name" {
  description = "Private S3 bucket that stores encrypted PostgreSQL backups."
  value       = aws_s3_bucket.postgres_backups.id
}

output "bff_session_tables" {
  description = "Per-environment BFF session tables when explicitly provisioned."
  value       = var.create_bff_session_infrastructure ? module.bff_sessions[0].table_names : {}
}

output "bff_session_kms_keys" {
  description = "Per-environment BFF session KMS keys when explicitly provisioned."
  value       = var.create_bff_session_infrastructure ? module.bff_sessions[0].kms_key_arns : {}
}

output "cognito_bff_clients" {
  description = "Sensitive Cognito BFF and machine client metadata; configure Secrets Manager through a separately reviewed secret operation."
  sensitive   = true
  value = {
    for env, client in module.cognito_bff : env => {
      resource_identifier = client.resource_identifier
      bff_client_id       = client.bff_client_id
      bff_client_secret   = client.bff_client_secret
      machine_clients     = client.machine_clients
    }
  }
}
