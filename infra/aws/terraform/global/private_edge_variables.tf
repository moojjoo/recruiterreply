variable "enable_private_edge_runtime_state" {
  description = "Provision protected Dev/Test signing-key containers and OAuth replay tables only. Does not populate secrets or create/associate Lambda@Edge."
  type        = bool
  default     = false
}

variable "private_edge_environments" {
  description = "Non-production environments eligible for private edge runtime, function, and association phases. Use [\"dev\"] for a Dev-only rollout."
  type        = set(string)
  default     = ["dev", "test"]

  validation {
    condition = (
      length(var.private_edge_environments) > 0 &&
      alltrue([for env in var.private_edge_environments : contains(["dev", "test"], env)])
    )
    error_message = "Private edge rollout may target only dev and/or test."
  }
}

variable "enable_private_edge_functions" {
  description = "Create reviewed, versioned Dev/Test Lambda@Edge functions only. Does not associate CloudFront or enable distributions."
  type        = bool
  default     = false
}

variable "private_edge_package_files" {
  description = "Local reviewed Lambda ZIP paths keyed by dev and test. Required only when private edge functions are enabled."
  type        = map(string)
  default     = {}
}

variable "enable_private_edge_associations" {
  description = "Attach reviewed Lambda@Edge versions to disabled Dev/Test distributions. Does not enable either distribution."
  type        = bool
  default     = false
}
