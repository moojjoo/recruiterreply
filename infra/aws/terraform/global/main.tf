data "aws_caller_identity" "current" {}

# Account-wide GitHub Actions OIDC trust + deploy role, shared by deploy-dev.yml,
# deploy-test.yml, and deploy-prod.yml. Not environment-scoped, so it lives here
# rather than in envs/*.
module "github_oidc" {
  source = "../modules/github_oidc"

  name_prefix    = var.app_name
  github_repo    = var.github_repo
  aws_account_id = data.aws_caller_identity.current.account_id
}

# Frontend S3 buckets + CloudFront distributions for all three environments.
# This module already fans out per environment internally (for_each over
# frontend_bucket_names), so it stays a single global apply rather than being
# split into envs/dev, envs/test, envs/prod.
module "frontend" {
  source = "../modules/frontend"

  create_buckets        = var.create_frontend_buckets
  frontend_bucket_names = var.frontend_bucket_names
  aws_account_id        = data.aws_caller_identity.current.account_id
  # Existing CloudFront IDs verified against the reviewed #345 Terraform plan.
  # These values must be reconciled if a distribution is ever replaced.
  existing_cloudfront_distribution_ids = {
    dev  = "E2JWU1TLDA6YRS"
    test = "E2IGR9MYMWVQFI"
    prod = "EHWW9BKSSF64L"
  }
  enable_private_edge_associations = (
    var.enable_private_edge_associations &&
    var.enable_private_edge_functions &&
    var.enable_private_edge_runtime_state &&
    var.enable_private_environment_identity
  )
  private_edge_association_environments = var.private_edge_environments
  private_edge_function_arns = {
    for env, function in module.private_edge_function : env => function.qualified_arn
  }
}

resource "aws_s3_bucket" "postgres_backups" {
  bucket        = "${var.app_name}-postgres-backups-${data.aws_caller_identity.current.account_id}"
  force_destroy = false

  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Name        = "${var.app_name}-postgres-backups"
    Application = var.app_name
    Purpose     = "PostgreSQL backups"
  }
}

resource "aws_s3_bucket_ownership_controls" "postgres_backups" {
  bucket = aws_s3_bucket.postgres_backups.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "postgres_backups" {
  bucket                  = aws_s3_bucket.postgres_backups.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "postgres_backups" {
  bucket = aws_s3_bucket.postgres_backups.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "postgres_backups" {
  bucket = aws_s3_bucket.postgres_backups.id

  rule {
    id     = "expire-postgres-backups-after-30-days"
    status = "Enabled"

    filter {}

    expiration {
      days = 30
    }
  }
}

data "aws_iam_policy_document" "postgres_backups" {
  statement {
    sid     = "DenyInsecureTransport"
    effect  = "Deny"
    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.postgres_backups.arn,
      "${aws_s3_bucket.postgres_backups.arn}/*",
    ]

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }

  statement {
    sid     = "RequireServerSideEncryption"
    effect  = "Deny"
    actions = ["s3:PutObject"]
    resources = [
      "${aws_s3_bucket.postgres_backups.arn}/*",
    ]

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    condition {
      test     = "StringNotEquals"
      variable = "s3:x-amz-server-side-encryption"
      values   = ["AES256"]
    }
  }
}

resource "aws_s3_bucket_policy" "postgres_backups" {
  bucket = aws_s3_bucket.postgres_backups.id
  policy = data.aws_iam_policy_document.postgres_backups.json
}
