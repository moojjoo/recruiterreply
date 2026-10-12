variable "name_prefix" {
  type = string
}

variable "ec2_role_name" {
  description = "Name of the IAM role attached to the backend EC2 instance, granted read access to the secret."
  type        = string
}

variable "backend_secret_name" {
  description = "Existing per-environment backend secret name; Terraform looks up metadata only."
  type        = string
}
