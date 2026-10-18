terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
    }
  }
}

resource "aws_cognito_resource_server" "api" {
  identifier   = var.resource_identifier
  name         = "recruiterreply-${var.environment}-api"
  user_pool_id = var.user_pool_id

  scope {
    scope_name        = "read"
    scope_description = "Read resources authorized for the caller."
  }

  scope {
    scope_name        = "write"
    scope_description = "Create or modify resources authorized for the caller."
  }

  scope {
    scope_name        = "admin"
    scope_description = "Explicitly audited administrative operations."
  }

  scope {
    scope_name        = "internal"
    scope_description = "Service-to-service operations only."
  }

}

resource "aws_cognito_user_pool_client" "bff" {
  name                                 = "recruiterreply-${var.environment}-bff"
  user_pool_id                         = var.user_pool_id
  generate_secret                      = true
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes = [
    "openid",
    "email",
    "profile",
    "${aws_cognito_resource_server.api.identifier}/read",
    "${aws_cognito_resource_server.api.identifier}/write",
  ]
  callback_urls                 = var.callback_urls
  logout_urls                   = var.logout_urls
  supported_identity_providers  = ["COGNITO"]
  prevent_user_existence_errors = "ENABLED"
  enable_token_revocation       = true
  auth_session_validity         = 10
  access_token_validity         = 15
  id_token_validity             = 15
  refresh_token_validity        = 1

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }

  depends_on = [aws_cognito_resource_server.api]
}

resource "aws_cognito_user_pool_client" "ci" {
  name                                 = "recruiterreply-${var.environment}-ci"
  user_pool_id                         = var.user_pool_id
  generate_secret                      = true
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["client_credentials"]
  allowed_oauth_scopes                 = ["${aws_cognito_resource_server.api.identifier}/read"]
  prevent_user_existence_errors        = "ENABLED"
  enable_token_revocation              = true

  depends_on = [aws_cognito_resource_server.api]
}

resource "aws_cognito_user_pool_client" "worker" {
  name                                 = "recruiterreply-${var.environment}-worker"
  user_pool_id                         = var.user_pool_id
  generate_secret                      = true
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["client_credentials"]
  allowed_oauth_scopes                 = ["${aws_cognito_resource_server.api.identifier}/read", "${aws_cognito_resource_server.api.identifier}/write"]
  prevent_user_existence_errors        = "ENABLED"
  enable_token_revocation              = true

  depends_on = [aws_cognito_resource_server.api]
}

resource "aws_cognito_user_pool_client" "ops" {
  name                                 = "recruiterreply-${var.environment}-ops"
  user_pool_id                         = var.user_pool_id
  generate_secret                      = true
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["client_credentials"]
  allowed_oauth_scopes                 = ["${aws_cognito_resource_server.api.identifier}/admin"]
  prevent_user_existence_errors        = "ENABLED"
  enable_token_revocation              = true

  depends_on = [aws_cognito_resource_server.api]
}
