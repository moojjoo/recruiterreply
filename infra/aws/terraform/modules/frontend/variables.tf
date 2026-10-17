variable "create_buckets" {
  type = bool
}

variable "frontend_bucket_names" {
  type = map(string)
}

variable "aws_account_id" {
  type = string
}

variable "cloudfront_aliases" {
  description = "Domain aliases per environment."
  type        = map(string)
  default = {
    dev  = "dev.recruiterreply.com"
    test = "test.recruiterreply.com"
    prod = "recruiterreply.com"
  }
}

variable "cloudfront_acm_certificate_arns" {
  description = "us-east-1 ACM certificate ARN per environment."
  type        = map(string)
  default = {
    dev  = "arn:aws:acm:us-east-1:178522450316:certificate/61c56203-0248-43d7-a408-7c1a3fa6ee3c"
    test = "arn:aws:acm:us-east-1:178522450316:certificate/61c56203-0248-43d7-a408-7c1a3fa6ee3c"
    prod = "arn:aws:acm:us-east-1:178522450316:certificate/0c6632df-cbfc-4563-8627-b50626642d02"
  }
}

variable "cloudfront_web_acl_ids" {
  description = "Optional WAFv2 WebACL ARN per environment."
  type        = map(string)
  default = {
    dev = "arn:aws:wafv2:us-east-1:178522450316:global/webacl/CreatedByCloudFront-02104336/6a7170c0-d51c-439e-97d7-31523ad776de"
  }
}

# Existing distribution IDs are explicit so bucket policies remain independent
# of unrelated CloudFront distribution configuration updates.
variable "existing_cloudfront_distribution_ids" {
  description = "IDs of existing distributions. Verify against Terraform state before modifying."
  type        = map(string)
  default     = {}
}

variable "enable_private_edge_associations" {
  description = "Associate reviewed versioned Lambda@Edge gates with disabled Dev/Test distributions. Never enables a distribution."
  type        = bool
  default     = false
}

variable "private_edge_association_environments" {
  description = "Dev/Test distributions that receive reviewed Lambda@Edge associations."
  type        = set(string)
  default     = []

  validation {
    condition     = alltrue([for env in var.private_edge_association_environments : contains(["dev", "test"], env)])
    error_message = "Private edge associations may target only dev and/or test."
  }
}

variable "private_edge_function_arns" {
  description = "Numbered Lambda@Edge version ARNs keyed by dev and test."
  type        = map(string)
  default     = {}
}

variable "enable_private_dev_distribution" {
  description = "Explicitly enable Dev only after its private authentication gateway is attached."
  type        = bool
  default     = false
}
