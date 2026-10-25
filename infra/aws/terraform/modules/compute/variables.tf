variable "name_prefix" {
  type = string
}

variable "subnet_id" {
  type = string
}

variable "ec2_security_group_id" {
  type = string
}

variable "instance_type" {
  type = string
}

variable "ami_id" {
  type = string
}

variable "key_name" {
  type    = string
  default = null
}

variable "root_volume_size" {
  type = number
}

variable "user_data" {
  type = string
}

variable "enable_public_ip" {
  type    = bool
  default = true
}

variable "enable_elastic_ip" {
  type    = bool
  default = false
}

variable "backup_bucket_arn" {
  type = string
}

variable "backup_environment" {
  type = string
}

variable "bff_session_table_arn" {
  description = "Optional BFF session table ARN."
  type        = string
  default     = null
}

variable "bff_session_kms_key_arn" {
  description = "Optional BFF session KMS key ARN."
  type        = string
  default     = null
}

variable "backend_secret_arn" {
  description = "Optional backend Secrets Manager ARN."
  type        = string
  default     = null
}

variable "log_group_arns" {
  description = "CloudWatch log groups the Docker awslogs driver may publish to."
  type        = list(string)
  default     = []
}
