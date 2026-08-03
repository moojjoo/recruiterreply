variable "name_prefix" {
  type = string
}

variable "ec2_role_name" {
  description = "Name of the IAM role attached to the backend EC2 instance, granted read access to the secret."
  type        = string
}

variable "recovery_window_in_days" {
  description = "Days AWS retains a deleted secret before permanent removal. 0 deletes immediately."
  type        = number
  default     = 7
}
