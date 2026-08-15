locals {
  buckets = var.create_buckets ? var.frontend_bucket_names : {}

  # prod's live CloudFront origin is a differently-named bucket than frontend_bucket_names["prod"]
  # (that one is an orphaned/empty leftover); override so we manage the bucket actually in use.
  origin_bucket_overrides = {
    prod = "recruiterreply-prod-frontend-4d2e1c61dac86c486324f7f490"
  }

  origin_bucket_names = {
    for key, bucket in aws_s3_bucket.this :
    key => lookup(local.origin_bucket_overrides, key, bucket.id)
  }

  origin_bucket_domains = {
    for key, bucket in aws_s3_bucket.this :
    key => contains(keys(local.origin_bucket_overrides), key) ? "${local.origin_bucket_overrides[key]}.s3.us-east-1.amazonaws.com" : bucket.bucket_regional_domain_name
  }

  origin_bucket_arns = {
    for key, bucket in aws_s3_bucket.this :
    key => contains(keys(local.origin_bucket_overrides), key) ? "arn:aws:s3:::${local.origin_bucket_overrides[key]}" : bucket.arn
  }

  # prod's distribution predates the CachePolicyId API and still uses legacy ForwardedValues.
  cloudfront_config = {
    dev = {
      allowed_methods      = ["HEAD", "GET"]
      use_forwarded_values = false
      comment              = "dev frontend recruiterreply.com"
    }
    test = {
      allowed_methods      = ["HEAD", "GET"]
      use_forwarded_values = false
      comment              = "test frontend recruiterreply.com"
    }
    prod = {
      allowed_methods      = ["HEAD", "GET", "OPTIONS"]
      use_forwarded_values = true
      comment              = "prod frontend recruiterreply.com"
    }
  }
}

resource "aws_s3_bucket" "this" {
  for_each = local.buckets

  bucket = each.value

  tags = {
    Name        = each.value
    BucketLabel = each.key
  }
}

resource "aws_s3_bucket_ownership_controls" "this" {
  for_each = aws_s3_bucket.this

  bucket = each.value.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "this" {
  for_each = aws_s3_bucket.this

  bucket                  = each.value.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "this" {
  for_each = aws_s3_bucket.this

  bucket = each.value.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  for_each = aws_s3_bucket.this

  bucket = each.value.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_cloudfront_origin_access_control" "this" {
  for_each = aws_s3_bucket.this

  name                              = "oac-${each.value.id}"
  description                       = "OAC for ${each.value.id}"
  signing_protocol                  = "sigv4"
  signing_behavior                  = "always"
  origin_access_control_origin_type = "s3"
}

resource "aws_cloudfront_distribution" "this" {
  for_each = aws_s3_bucket.this

  comment             = local.cloudfront_config[each.key].comment
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  price_class         = "PriceClass_All"
  http_version        = "http2"
  aliases             = [var.cloudfront_aliases[each.key]]
  web_acl_id          = lookup(var.cloudfront_web_acl_ids, each.key, null)

  origin {
    domain_name              = local.origin_bucket_domains[each.key]
    origin_id                = "${local.origin_bucket_names[each.key]}-origin"
    origin_access_control_id = aws_cloudfront_origin_access_control.this[each.key].id
  }

  default_cache_behavior {
    target_origin_id       = "${local.origin_bucket_names[each.key]}-origin"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = local.cloudfront_config[each.key].allowed_methods
    cached_methods         = ["HEAD", "GET"]
    compress               = true
    cache_policy_id        = local.cloudfront_config[each.key].use_forwarded_values ? null : "658327ea-f89d-4fab-a63d-7e88639e58f6"

    dynamic "forwarded_values" {
      for_each = local.cloudfront_config[each.key].use_forwarded_values ? [1] : []
      content {
        query_string = false
        cookies {
          forward = "none"
        }
      }
    }
  }

  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = var.cloudfront_acm_certificate_arns[each.key]
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}

data "aws_iam_policy_document" "cloudfront_read" {
  for_each = aws_s3_bucket.this

  statement {
    sid       = "AllowCloudFrontServicePrincipal"
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${local.origin_bucket_arns[each.key]}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "ArnLike"
      variable = "AWS:SourceArn"
      values   = ["arn:aws:cloudfront::${var.aws_account_id}:distribution/${aws_cloudfront_distribution.this[each.key].id}"]
    }
  }
}

resource "aws_s3_bucket_policy" "this" {
  for_each = aws_s3_bucket.this

  bucket = local.origin_bucket_names[each.key]
  policy = data.aws_iam_policy_document.cloudfront_read[each.key].json
}
