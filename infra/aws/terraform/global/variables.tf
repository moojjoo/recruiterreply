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

variable "create_bff_session_infrastructure" {
  description = "Create opt-in per-environment BFF session tables and KMS keys. Requires a reviewed plan before enabling."
  type        = bool
  default     = false
}

variable "bff_session_environments" {
  description = "Environments for the BFF session infrastructure when explicitly enabled."
  type        = set(string)
  default     = ["dev", "test", "prod"]
}

variable "enable_cognito_bff" {
  description = "Create explicit Dev/Test Cognito API resource servers and confidential BFF/machine clients. Requires reviewed inputs and plan."
  type        = bool
  default     = false
}

variable "cognito_bff_environments" {
  description = "Cognito BFF environments to provision."
  type        = set(string)
  default     = ["dev", "test"]

  validation {
    condition     = length(var.cognito_bff_environments) > 0 && alltrue([for env in var.cognito_bff_environments : contains(["dev", "test"], env)])
    error_message = "Cognito BFF provisioning may target only dev and test."
  }
}

variable "cognito_bff_user_pool_ids" {
  description = "Existing Cognito user pool IDs keyed by environment."
  type        = map(string)
  default     = {}
}

variable "cognito_bff_resource_identifiers" {
  description = "Environment-specific Cognito API audience/resource identifiers."
  type        = map(string)
  default     = {}
}

variable "cognito_bff_callback_urls" {
  description = "Allowed BFF callback URLs keyed by environment."
  type        = map(list(string))
  default     = {}
}

variable "cognito_bff_logout_urls" {
  description = "Allowed BFF logout URLs keyed by environment."
  type        = map(list(string))
  default     = {}
}
