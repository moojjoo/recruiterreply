# Creating these identity resources alone does NOT protect CloudFront.
# This module stays off by default and must not enable Dev/Test distributions.
module "private_environment_identity" {
  for_each = var.enable_private_environment_identity ? var.private_environment_identity_environments : toset([])

  source        = "../modules/private_environment_identity"
  environment   = each.key
  domain_prefix = var.private_environment_cognito_domain_prefixes[each.key]
  application_managed_login_domain = lookup(
    var.private_environment_application_managed_login_domains, each.key, ""
  )
  application_managed_login_certificate_arn = lookup(
    var.private_environment_application_managed_login_certificate_arns, each.key, ""
  )
  callback_urls  = ["https://${each.key}.recruiterreply.com/_auth/callback"]
  logout_urls    = ["https://${each.key}.recruiterreply.com/"]
  ses_from_email = var.private_environment_ses_from_email
  ses_source_arn = var.private_environment_ses_source_arn
}

data "aws_route53_zone" "application_managed_login" {
  count = length(var.private_environment_application_managed_login_domains) == 0 ? 0 : 1

  name         = "recruiterreply.com."
  private_zone = false
}

resource "aws_route53_record" "application_managed_login" {
  for_each = {
    for env, identity in module.private_environment_identity : env => identity
    if identity.application_managed_login_distribution != null
  }

  zone_id = data.aws_route53_zone.application_managed_login[0].zone_id
  name    = var.private_environment_application_managed_login_domains[each.key]
  type    = "A"

  alias {
    name                   = each.value.application_managed_login_distribution.domain_name
    zone_id                = each.value.application_managed_login_distribution.zone_id
    evaluate_target_health = false
  }
}

check "private_environment_identity_prerequisites" {
  assert {
    condition = !var.enable_private_environment_identity || (
      length(trimspace(var.private_environment_ses_from_email)) > 0 &&
      length(trimspace(var.private_environment_ses_source_arn)) > 0 &&
      alltrue([
        for env in var.private_environment_identity_environments :
        length(trimspace(lookup(var.private_environment_cognito_domain_prefixes, env, ""))) > 0
      ]) &&
      length(distinct([
        for env in var.private_environment_identity_environments :
        lookup(var.private_environment_cognito_domain_prefixes, env, "")
      ])) == length(var.private_environment_identity_environments)
    )
    error_message = "Cognito opt-in requires a verified SES sender, identity ARN and a distinct domain prefix for every selected environment."
  }
}

check "application_managed_login_prerequisites" {
  assert {
    condition = (
      toset(keys(var.private_environment_application_managed_login_domains)) ==
      toset(keys(var.private_environment_application_managed_login_certificate_arns)) &&
      toset(keys(var.private_environment_application_managed_login_domains)) ==
      var.cognito_bff_managed_login_branding_environments &&
      alltrue([
        for env in keys(var.private_environment_application_managed_login_domains) :
        var.enable_private_environment_identity &&
        contains(var.private_environment_identity_environments, env) &&
        contains(var.cognito_bff_managed_login_branding_environments, env)
      ])
    )
    error_message = "Managed application login requires matching domain/certificate keys plus enabled identity and BFF branding for the same Dev environment."
  }
}

output "private_environment_cognito_identity" {
  description = "Non-secret Cognito identity metadata; pools alone do not protect CloudFront."
  value = {
    for env, identity in module.private_environment_identity : env => {
      user_pool_id  = identity.user_pool_id
      client_id     = identity.client_id
      hosted_domain = identity.hosted_domain
      application_managed_login_domain = lookup(
        var.private_environment_application_managed_login_domains, env, null
      )
    }
  }
}
