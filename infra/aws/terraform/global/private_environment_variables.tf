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

variable "private_environment_allowed_admin_emails" {
  description = "Reserved for administrative onboarding; no user accounts are auto-created."
  type        = list(string)
  default     = []
}
