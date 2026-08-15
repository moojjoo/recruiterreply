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
