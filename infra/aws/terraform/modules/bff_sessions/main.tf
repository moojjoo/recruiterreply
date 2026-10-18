resource "aws_kms_key" "sessions" {
  for_each = var.environments

  description             = "${var.app_name} ${each.key} BFF session encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = merge(var.tags, {
    Application = var.app_name
    Environment = each.key
    Purpose     = "BFF OAuth session encryption"
  })
}

resource "aws_kms_alias" "sessions" {
  for_each = var.environments

  name          = "alias/${var.app_name}-${each.key}-bff-sessions"
  target_key_id = aws_kms_key.sessions[each.key].key_id
}

resource "aws_dynamodb_table" "sessions" {
  for_each = var.environments

  name         = "${var.app_name}-${each.key}-bff-sessions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "session_id_hash"

  attribute {
    name = "session_id_hash"
    type = "S"
  }

  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.sessions[each.key].arn
  }

  lifecycle {
    prevent_destroy = true
  }

  tags = merge(var.tags, {
    Application = var.app_name
    Environment = each.key
    Purpose     = "BFF OAuth sessions"
  })
}
