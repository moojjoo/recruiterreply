variable "enable_private_edge_runtime_state" {
  description = "Provision protected Dev/Test signing-key containers and OAuth replay tables only. Does not populate secrets or create/associate Lambda@Edge."
  type        = bool
  default     = false
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
