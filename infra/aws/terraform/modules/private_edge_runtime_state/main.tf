terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 6.0"
    }
  }
}

variable "environment" {
  type = string
  validation {
    condition     = contains(["dev", "test"], var.environment)
    error_message = "Only dev and test may use private edge runtime state."
  }
}

variable "name_prefix" {
  type    = string
  default = "recruiterreply"
}

resource "aws_secretsmanager_secret" "signing_keys" {
  name                    = "${var.name_prefix}/${var.environment}/edge-auth-signing-keys"
  description             = "Signing keys for ${var.environment} private edge sessions and OAuth transactions"
  recovery_window_in_days = 30

  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Environment = var.environment
    Purpose     = "private-edge-auth-signing"
  }
}

# Deliberately no aws_secretsmanager_secret_version resource: signing-key values
# must never enter Terraform configuration, plans, or state.

resource "aws_dynamodb_table" "oauth_replay" {
  name         = "${var.name_prefix}-${var.environment}-oauth-replay"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "transaction_key"

  attribute {
    name = "transaction_key"
    type = "S"
  }

  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = {
    Environment = var.environment
    Purpose     = "private-edge-oauth-replay"
  }
}

output "signing_key_secret_arn" {
  description = "Secret container ARN. Populate AWSCURRENT out of band; values never belong in Terraform state."
  value       = aws_secretsmanager_secret.signing_keys.arn
}

output "replay_table_arn" {
  value = aws_dynamodb_table.oauth_replay.arn
}

output "replay_table_name" {
  value = aws_dynamodb_table.oauth_replay.name
}
