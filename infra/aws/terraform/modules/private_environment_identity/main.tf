# Issue #356 — Cognito identity foundation for protected non-production sites.
# Intentionally NOT instantiated by the Terraform roots until the edge authorizer,
# callback flow, API protections and SES identity have been reviewed together.
# Creating a user pool by itself does not restrict CloudFront access.
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

variable "environment" {
  type = string
  validation {
    condition     = contains(["dev", "test"], var.environment)
    error_message = "Only dev and test may use this module."
  }
}

variable "domain_prefix" {
  type = string
}

variable "callback_urls" {
  type = list(string)
  validation {
    condition     = length(var.callback_urls) > 0 && alltrue([for url in var.callback_urls : startswith(url, "https://")])
    error_message = "Only HTTPS callback URLs are allowed."
  }
}

variable "logout_urls" {
  type = list(string)
  validation {
    condition     = length(var.logout_urls) > 0 && alltrue([for url in var.logout_urls : startswith(url, "https://")])
    error_message = "Only HTTPS logout URLs are allowed."
  }
}

variable "ses_from_email" {
  type = string
}

variable "ses_source_arn" {
  type = string
}

resource "aws_cognito_user_pool" "testers" {
  name                       = "recruiterreply-${var.environment}-testers"
  deletion_protection        = "ACTIVE"
  username_attributes        = ["email"]
  auto_verified_attributes   = ["email"]
  mfa_configuration          = "ON"
  user_pool_tier             = "ESSENTIALS"
  enabled_mfas               = ["EMAIL_OTP"]

  admin_create_user_config {
    allow_admin_create_user_only = true
  }

  email_configuration {
    email_sending_account  = "DEVELOPER"
    from_email_address     = var.ses_from_email
    source_arn             = var.ses_source_arn
  }

  email_mfa_configuration {
    subject = "RecruiterReply ${var.environment} sign-in verification"
    message = "Your RecruiterReply verification code is {####}. This code expires shortly. Do not share it."
  }

  password_policy {
    minimum_length                   = 14
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = true
    require_uppercase                = true
    temporary_password_validity_days = 2
  }

  account_recovery_setting {
    # With email MFA, the same email address cannot also serve as the
    # password-recovery channel. Admin recovery is required.
    recovery_mechanism {
      name     = "admin_only"
      priority = 1
    }
  }
}

resource "aws_cognito_user_pool_client" "browser" {
  name                                 = "recruiterreply-${var.environment}-browser"
  user_pool_id                         = aws_cognito_user_pool.testers.id
  generate_secret                      = false
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email"]
  callback_urls                        = var.callback_urls
  logout_urls                          = var.logout_urls
  supported_identity_providers         = ["COGNITO"]
  prevent_user_existence_errors        = "ENABLED"
  enable_token_revocation              = true
  access_token_validity                = 15
  id_token_validity                    = 15
  refresh_token_validity               = 1
  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }
}

resource "aws_cognito_user_pool_domain" "hosted" {
  domain       = var.domain_prefix
  user_pool_id = aws_cognito_user_pool.testers.id
}

output "user_pool_id" {
  value = aws_cognito_user_pool.testers.id
}

output "client_id" {
  value = aws_cognito_user_pool_client.browser.id
}

output "hosted_domain" {
  value = aws_cognito_user_pool_domain.hosted.domain
}
