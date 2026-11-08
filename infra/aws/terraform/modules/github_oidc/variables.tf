variable "name_prefix" {
  type        = string
  description = "Prefix for resource names, matching the rest of the stack."
}

variable "github_repo" {
  type        = string
  description = "GitHub repo allowed to assume this role, as \"owner/repo\"."
}

variable "aws_account_id" {
  type        = string
  description = "AWS account ID, used to scope ECR/S3 ARNs in the legacy inline policy."
}

variable "aws_region" {
  type        = string
  description = "AWS region containing the RecruiterReply resources."
}

variable "github_environments" {
  type        = set(string)
  description = "GitHub environment names allowed to assume the shared deployment role."

  validation {
    condition     = length(var.github_environments) > 0 && alltrue([for environment in var.github_environments : contains(["dev", "test", "prod"], environment)])
    error_message = "GitHub deployment trust may target only the approved dev, test, and prod environments."
  }
}

variable "frontend_bucket_names" {
  type        = map(string)
  description = "Known frontend buckets that the deployment role may publish to."
}

variable "cloudfront_distribution_ids" {
  type        = map(string)
  description = "Known CloudFront distributions that the deployment role may invalidate."
}

variable "ec2_instance_id" {
  type        = string
  description = "The shared RecruiterReply EC2 instance targeted by SSM deployments."

  validation {
    condition     = can(regex("^i-[0-9a-f]+$", var.ec2_instance_id))
    error_message = "ec2_instance_id must be an EC2 instance ID."
  }
}
