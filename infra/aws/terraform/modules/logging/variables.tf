variable "app_name" {
  type    = string
  default = "recruiterreply"
}

variable "environments" {
  description = "Environment name to CloudWatch retention days."
  type        = map(number)
  default     = { dev = 7, test = 14, prod = 30 }
}

variable "tags" {
  type    = map(string)
  default = {}
}

variable "alert_topic_arn" {
  description = "Optional owner-configured SNS topic for production error alarms."
  type        = string
  default     = null
}
