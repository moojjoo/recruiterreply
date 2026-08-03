output "vpc_id" {
  description = "ID of the VPC."
  value       = module.network.vpc_id
}

output "public_subnet_ids" {
  description = "IDs of public subnets."
  value       = module.network.public_subnet_ids
}

output "private_subnet_ids" {
  description = "IDs of private subnets."
  value       = module.network.private_subnet_ids
}

output "ec2_instance_id" {
  description = "ID of the EC2 instance."
  value       = module.compute.instance_id
}

output "ec2_public_ip" {
  description = "Public IP of the EC2 instance."
  value       = module.compute.public_ip
}

output "ec2_public_dns" {
  description = "Public DNS of the EC2 instance."
  value       = module.compute.public_dns
}

output "rds_endpoint" {
  description = "RDS endpoint address when enabled."
  value       = var.enable_rds ? module.database[0].endpoint : null
}

output "rds_port" {
  description = "RDS endpoint port when enabled."
  value       = var.enable_rds ? module.database[0].port : null
}

output "frontend_buckets" {
  description = "Frontend S3 buckets keyed by label."
  value       = module.frontend.bucket_names
}

output "backend_secret_arn" {
  description = "ARN of the Secrets Manager secret holding backend runtime config."
  value       = module.secrets.secret_arn
}

output "backend_secret_name" {
  description = "Name of the Secrets Manager secret holding backend runtime config. Set AWS_SECRETS_MANAGER_SECRET_NAME to this on the backend host."
  value       = module.secrets.secret_name
}
