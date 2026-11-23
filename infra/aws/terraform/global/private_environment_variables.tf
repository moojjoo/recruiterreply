# Cognito user pools are opt-in. They do NOT authorize CloudFront requests.
# Keep both CloudFront distributions disabled until the independently reviewed
# edge gate, sessions and API isolation are deployed and tested.
variable "enable_private_environment_identity" {
  description = "Provision invite-only Dev/Test Cognito pools only. Does not grant frontend access."
  type        = bool
  default     = false
}

variable "private_environment_identity_environments" {
  description = "Non-production environments whose Cognito identity resources may be provisioned when enabled. Use [\"dev\"] for a Dev-only rollout."
  type        = set(string)
  default     = ["dev", "test"]

  validation {
    condition = (
      length(var.private_environment_identity_environments) > 0 &&
      alltrue([for env in var.private_environment_identity_environments : contains(["dev", "test"], env)])
    )
    error_message = "Private environment identity may target only dev and/or test."
  }
}

variable "private_environment_ses_from_email" {
  description = "Verified SES From address for Cognito MFA. Required when enabled."
  type        = string
  default     = ""
}

variable "private_environment_ses_source_arn" {
  description = "Verified SES identity ARN in us-east-1. Required when enabled."
  type        = string
  default     = ""
}

variable "private_environment_cognito_domain_prefixes" {
  description = "Globally unique Cognito hosted UI domain prefixes for dev and test."
  type        = map(string)
  default     = {}
}

variable "private_environment_application_managed_login_domains" {
  description = "Exact Dev-only custom domain for application native managed login. Empty keeps the feature off."
  type        = map(string)
  default     = {}

  validation {
    condition = alltrue([
      for env, domain in var.private_environment_application_managed_login_domains :
      env == "dev" && domain == "app-auth-dev.recruiterreply.com"
    ])
    error_message = "Only app-auth-dev.recruiterreply.com may be configured, for Dev only."
  }
}

variable "private_environment_application_managed_login_certificate_arns" {
  description = "Reviewed us-east-1 ACM certificate for the Dev application managed-login domain."
  type        = map(string)
  default     = {}

  validation {
    condition = alltrue([
      for env, arn in var.private_environment_application_managed_login_certificate_arns :
      env == "dev" && can(regex("^arn:aws:acm:us-east-1:[0-9]{12}:certificate/[0-9a-f-]+$", arn))
    ])
    error_message = "Only a reviewed us-east-1 ACM certificate ARN may be configured for Dev."
  }
}

variable "private_environment_allowed_admin_emails" {
  description = "Reserved for administrative onboarding; no user accounts are auto-created."
  type        = list(string)
  default     = []
}
