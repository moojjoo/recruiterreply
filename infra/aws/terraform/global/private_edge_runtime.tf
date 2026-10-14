# Phase one for Issue #356: non-secret runtime resource containers only.
# This does not create a Lambda function, associate CloudFront, enable a
# distribution, or populate signing-key values.
module "private_edge_runtime_state" {
  for_each = var.enable_private_edge_runtime_state ? toset(["dev", "test"]) : toset([])

  source      = "../modules/private_edge_runtime_state"
  environment = each.key
  name_prefix = var.app_name
}

# Phase two creates immutable, versioned functions from separately reviewed ZIPs.
# It deliberately does not associate CloudFront or enable a distribution.
module "private_edge_function" {
  for_each = (
    var.enable_private_edge_functions &&
    var.enable_private_edge_runtime_state &&
    var.enable_private_environment_identity
  ) ? toset(["dev", "test"]) : toset([])

  source      = "../modules/private_edge_function"
  environment = each.key
  name_prefix = var.app_name
  package_file = try(
    var.private_edge_package_files[each.key],
    ""
  )
  signing_key_secret_arn = module.private_edge_runtime_state[each.key].signing_key_secret_arn
  replay_table_arn       = module.private_edge_runtime_state[each.key].replay_table_arn
}

check "private_edge_runtime_region" {
  assert {
    condition     = !var.enable_private_edge_runtime_state || var.aws_region == "us-east-1"
    error_message = "Private edge runtime resources must be provisioned in us-east-1."
  }
}

check "private_edge_function_prerequisites" {
  assert {
    condition = !var.enable_private_edge_functions || (
      var.enable_private_edge_runtime_state &&
      var.enable_private_environment_identity &&
      var.aws_region == "us-east-1" &&
      alltrue([
        for env in ["dev", "test"] :
        fileexists(try(var.private_edge_package_files[env], ""))
      ])
    )
    error_message = "Private edge functions require enabled runtime state and Cognito identity plus reviewed Dev/Test ZIP files in us-east-1."
  }
}

check "private_edge_association_prerequisites" {
  assert {
    condition = !var.enable_private_edge_associations || (
      var.enable_private_edge_functions &&
      var.enable_private_edge_runtime_state &&
      var.enable_private_environment_identity
    )
    error_message = "Private edge associations require the reviewed identity, runtime state, and versioned function phases."
  }
}

output "private_edge_runtime_state" {
  description = "Non-secret Dev/Test edge runtime identifiers. Empty unless explicitly enabled."
  value = {
    for env, runtime in module.private_edge_runtime_state : env => {
      signing_key_secret_arn = runtime.signing_key_secret_arn
      replay_table_arn       = runtime.replay_table_arn
      replay_table_name      = runtime.replay_table_name
    }
  }
}

output "private_edge_function_versions" {
  description = "Numbered Dev/Test Lambda versions. Empty unless phase two is explicitly enabled."
  value = {
    for env, function in module.private_edge_function : env => {
      qualified_arn = function.qualified_arn
      version       = function.version
    }
  }
}
