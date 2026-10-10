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
