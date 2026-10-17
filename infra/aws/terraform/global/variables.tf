variable "aws_region" {
  description = "AWS region for all resources."
  type        = string
  default     = "us-east-1"
}

variable "app_name" {
  description = "Application name used in resource naming."
  type        = string
  default     = "recruiterreply"
}

variable "tags" {
  description = "Additional tags applied to all resources."
  type        = map(string)
  default     = {}
}

variable "github_repo" {
  description = "GitHub repo allowed to assume the deploy role, as \"owner/repo\"."
  type        = string
  default     = "moojjoo/recruiterreply"
}

variable "create_frontend_buckets" {
  description = "Whether to create frontend S3 buckets for static app hosting."
  type        = bool
  default     = true
}

variable "frontend_bucket_names" {
  description = "Map of environment label (dev/test/prod) to S3 bucket name for frontend builds."
  type        = map(string)
  default     = {}
}

variable "enable_private_dev_distribution" {
  description = "Explicitly enable Dev only after its private authentication gateway is attached."
  type        = bool
  default     = false
}

variable "enable_private_test_distribution" {
  description = "Explicitly enable Test only after its private authentication gateway is attached."
  type        = bool
  default     = false
}

variable "enable_private_test_api_routing" {
  description = "Route Test API requests through its authenticated CloudFront distribution."
  type        = bool
  default     = false
}

variable "enable_private_dev_api_routing" {
  description = "Route Dev /api/* through its authenticated CloudFront distribution."
  type        = bool
  default     = false
}
