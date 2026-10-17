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
  name                     = "recruiterreply-${var.environment}-testers"
  deletion_protection      = "ACTIVE"
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]
  mfa_configuration        = "ON"
  user_pool_tier           = "ESSENTIALS"

  admin_create_user_config {
    allow_admin_create_user_only = true
  }

  email_configuration {
    email_sending_account = "DEVELOPER"
    from_email_address    = var.ses_from_email
    source_arn            = var.ses_source_arn
  }

  email_mfa_configuration {
    subject = "RecruiterReply ${var.environment} sign-in verification"
    message = <<-HTML
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>RecruiterReply verification code</title>
        </head>
        <body style="margin:0;padding:24px;background:#f3f6fb;color:#172033;font-family:Arial,Helvetica,sans-serif;line-height:1.5">
          <main style="max-width:560px;margin:0 auto;padding:32px;background:#ffffff;border:1px solid #dbe3ef;border-radius:12px">
            <p style="margin:0 0 20px;font-size:20px;font-weight:700;color:#1d4ed8">RecruiterReply</p>
            <h1 style="margin:0 0 16px;font-size:26px;line-height:1.25">Verify your email address</h1>
            <p style="margin:0 0 24px">Enter the following verification code to finish signing in to the RecruiterReply ${var.environment} environment.</p>
            <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:1.4px;color:#526074">YOUR VERIFICATION CODE</p>
            <p aria-label="Verification code" style="margin:0 0 16px;padding:18px;border-radius:10px;background:#eef4ff;color:#172033;font-size:34px;font-weight:700;letter-spacing:8px;text-align:center;user-select:all;-webkit-user-select:all"><strong>{####}</strong></p>
            <p style="margin:0 0 20px;color:#526074">Select the six-digit code above, copy it, and paste it into the sign-in page.</p>
            <p style="margin:0 0 12px">This code expires in <strong>10 minutes</strong>. Do not share it.</p>
            <p style="margin:0 0 24px">If you did not request this code, you can ignore this email.</p>
            <p style="margin:0;padding-top:18px;border-top:1px solid #dbe3ef;font-size:13px;color:#526074">RecruiterReply.com &mdash; Simplifying your job search.</p>
          </main>
        </body>
      </html>
    HTML
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
  auth_session_validity                = 10
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
