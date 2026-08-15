variable "aws_region" {
  description = "AWS region for all resources."
  type        = string
}

variable "app_name" {
  description = "Application name used in resource naming."
  type        = string
  default     = "recruiterreply"
}

variable "environment" {
  description = "Deployment environment name for this root (e.g. development, test, production)."
  type        = string
}

variable "tags" {
  description = "Additional tags applied to all resources."
  type        = map(string)
  default     = {}
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
}

variable "availability_zones" {
  description = "Availability zones used for public/private subnet pairs."
  type        = list(string)
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets."
  type        = list(string)
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets."
  type        = list(string)
}

variable "allowed_ssh_cidrs" {
  description = "CIDR blocks allowed to SSH into EC2."
  type        = list(string)
  default     = []
}

variable "public_ingress_cidrs" {
  description = "CIDR blocks allowed to access HTTP/HTTPS."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "ami_id" {
  description = "AMI ID for the EC2 instance."
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type for app host."
  type        = string
  default     = "t3.small"
}

variable "key_name" {
  description = "Optional EC2 key pair name."
  type        = string
  default     = null
}

variable "ec2_root_volume_size" {
  description = "Root EBS volume size in GiB."
  type        = number
  default     = 30
}

variable "enable_rds" {
  description = "Whether to provision an RDS PostgreSQL instance."
  type        = bool
  default     = true
}

variable "db_name" {
  description = "RDS database name."
  type        = string
  default     = "recruiterreply"
}

variable "db_username" {
  description = "RDS master username."
  type        = string
  default     = "recruiterreply_admin"
}

variable "db_password" {
  description = "RDS master password. Leave null to auto-generate."
  type        = string
  default     = null
  sensitive   = true
}

variable "db_instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  description = "Initial RDS storage size in GiB."
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  description = "Maximum RDS autoscaling storage size in GiB."
  type        = number
  default     = 100
}

variable "db_backup_retention_period" {
  description = "Number of days to retain automated DB backups."
  type        = number
  default     = 7
}

variable "db_multi_az" {
  description = "Enable Multi-AZ for RDS."
  type        = bool
  default     = false
}

variable "db_deletion_protection" {
  description = "Enable deletion protection on RDS."
  type        = bool
  default     = false
}

variable "db_skip_final_snapshot" {
  description = "Skip final snapshot on destroy. Use false in prod."
  type        = bool
  default     = true
}

variable "db_engine_version" {
  description = "PostgreSQL engine version for RDS."
  type        = string
  default     = "16.3"
}
