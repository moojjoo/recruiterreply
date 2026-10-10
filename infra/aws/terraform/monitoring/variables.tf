variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "instance_id" {
  type    = string
  default = "i-0dbe396e361ea6d56"
}

variable "alert_email" {
  type        = string
  description = "Email recipient; SNS confirmation is required before notifications work."
}

variable "cpu_threshold" {
  type    = number
  default = 85
}

variable "memory_threshold" {
  type    = number
  default = 80
}

variable "disk_threshold" {
  type    = number
  default = 80
}
