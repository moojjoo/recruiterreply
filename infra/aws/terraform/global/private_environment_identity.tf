# Creating these identity resources alone does NOT protect CloudFront.
# This module stays off by default and must not enable Dev/Test distributions.
module "private_environment_identity" {
  for_each = var.enable_private_environment_identity ? toset(["dev", "test"]) : toset([])

  source         = "../modules/private_environment_identity"
  environment    = each.key
  domain_prefix  = var.private_environment_cognito_domain_prefixes[each.key]
  callback_urls  = ["https://${each.key}.recruiterreply.com/_auth/callback"]
  logout_urls    = ["https://${each.key}.recruiterreply.com/"]
  ses_from_email = var.private_environment_ses_from_email
  ses_source_arn = var.private_environment_ses_source_arn
}

check "private_environment_identity_prerequisites" {
  assert {
    condition = !var.enable_private_environment_identity || (
      length(trimspace(var.private_environment_ses_from_email)) > 0 &&
      length(trimspace(var.private_environment_ses_source_arn)) > 0 &&
      alltrue([
        for env in ["dev", "test"] :
        length(trimspace(lookup(var.private_environment_cognito_domain_prefixes, env, ""))) > 0
      ]) &&
      lookup(var.private_environment_cognito_domain_prefixes, "dev", "") != lookup(var.private_environment_cognito_domain_prefixes, "test", "")
    )
    error_message = "Cognito opt-in requires a verified SES sender, identity ARN and distinct Dev/Test domain prefixes."
  }
}

output "private_environment_cognito_identity" {
  description = "Non-secret Cognito identity metadata; pools alone do not protect CloudFront."
  value = {
    for env, identity in module.private_environment_identity : env => {
      user_pool_id  = identity.user_pool_id
      client_id     = identity.client_id
      hosted_domain = identity.hosted_domain
    }
  }
}
