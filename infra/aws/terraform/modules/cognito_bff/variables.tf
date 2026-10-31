variable "environment" {
  type = string

  validation {
    condition     = contains(["dev", "test"], var.environment)
    error_message = "The Cognito BFF module may only target dev or test."
  }
}

variable "user_pool_id" {
  description = "Existing Cognito user pool used by this environment."
  type        = string
}

variable "resource_identifier" {
  description = "Environment-specific Cognito resource-server identifier/audience."
  type        = string
}

variable "callback_urls" {
  type = list(string)

  validation {
    condition     = length(var.callback_urls) > 0 && alltrue([for url in var.callback_urls : startswith(url, "https://")])
    error_message = "Cognito BFF callback URLs must be HTTPS."
  }
}

variable "logout_urls" {
  type = list(string)

  validation {
    condition     = length(var.logout_urls) > 0 && alltrue([for url in var.logout_urls : startswith(url, "https://")])
    error_message = "Cognito BFF logout URLs must be HTTPS."
  }
}

variable "tags" {
  type    = map(string)
  default = {}
}
