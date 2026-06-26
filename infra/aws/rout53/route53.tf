terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

provider "aws" {
  alias  = "use1"
  region = "us-east-1"
}

data "aws_caller_identity" "current" {}

locals {
  create_prod_certificate = var.create_cloudfront_distribution
}

variable "aws_region" {
  description = "AWS region for Route 53 operations."
  type        = string
  default     = "us-east-1"
}

variable "domain_name" {
  description = "Root domain managed in Route 53."
  type        = string
  default     = "recruiterreply.com"
}

variable "api_target_ipv4" {
  description = "Public IPv4 (or EIP) for EC2 API hostnames."
  type        = string
}

variable "cloudfront_zone_id" {
  description = "CloudFront hosted zone ID (usually Z2FDTNDATAQYW2)."
  type        = string
  default     = "Z2FDTNDATAQYW2"
}

variable "create_cloudfront_distribution" {
  description = "Create a production CloudFront distribution backed by an S3 bucket."
  type        = bool
  default     = true
}

variable "prod_frontend_bucket_name" {
  description = "Optional fixed bucket name for production frontend. Leave empty to auto-generate with bucket_prefix."
  type        = string
  default     = ""
}

variable "create_frontend_records" {
  description = "Create frontend Route 53 alias records to CloudFront distributions. Set false until CloudFront is ready."
  type        = bool
  default     = false
}

variable "dev_cloudfront_domain_name" {
  description = "CloudFront domain for dev frontend (for example d111111abcdef8.cloudfront.net)."
  type        = string
  default     = ""
}

variable "test_cloudfront_domain_name" {
  description = "CloudFront domain for test frontend (for example d222222abcdef8.cloudfront.net)."
  type        = string
  default     = ""
}

variable "prod_cloudfront_domain_name" {
  description = "CloudFront domain for prod frontend (for example d333333abcdef8.cloudfront.net)."
  type        = string
  default     = ""
}

variable "cloudfront_tls_min_protocol_version" {
  description = "Minimum TLS version enforced by CloudFront when using ACM cert."
  type        = string
  default     = "TLSv1.2_2021"
}

resource "aws_route53_zone" "root" {
  name = var.domain_name
}

# Frontend domains to CloudFront distributions.
resource "aws_route53_record" "frontend_dev" {
  count   = var.create_frontend_records && var.dev_cloudfront_domain_name != "" ? 1 : 0
  zone_id = aws_route53_zone.root.zone_id
  name    = "dev.${var.domain_name}"
  type    = "A"

  alias {
    name                   = var.dev_cloudfront_domain_name
    zone_id                = var.cloudfront_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "frontend_test" {
  count   = var.create_frontend_records && var.test_cloudfront_domain_name != "" ? 1 : 0
  zone_id = aws_route53_zone.root.zone_id
  name    = "test.${var.domain_name}"
  type    = "A"

  alias {
    name                   = var.test_cloudfront_domain_name
    zone_id                = var.cloudfront_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "frontend_prod" {
  count   = var.create_frontend_records && (var.prod_cloudfront_domain_name != "" || var.create_cloudfront_distribution) ? 1 : 0
  zone_id = aws_route53_zone.root.zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = var.prod_cloudfront_domain_name != "" ? var.prod_cloudfront_domain_name : aws_cloudfront_distribution.prod_frontend[0].domain_name
    zone_id                = var.cloudfront_zone_id
    evaluate_target_health = false
  }
}

# API domains to EC2 public IP/EIP.
resource "aws_route53_record" "api_dev" {
  zone_id = aws_route53_zone.root.zone_id
  name    = "api-dev.${var.domain_name}"
  type    = "A"
  ttl     = 300
  records = [var.api_target_ipv4]
}

resource "aws_route53_record" "api_test" {
  zone_id = aws_route53_zone.root.zone_id
  name    = "api-test.${var.domain_name}"
  type    = "A"
  ttl     = 300
  records = [var.api_target_ipv4]
}

resource "aws_route53_record" "api_prod" {
  zone_id = aws_route53_zone.root.zone_id
  name    = "api.${var.domain_name}"
  type    = "A"
  ttl     = 300
  records = [var.api_target_ipv4]
}

resource "aws_s3_bucket" "prod_frontend" {
  count = var.create_cloudfront_distribution ? 1 : 0

  bucket        = var.prod_frontend_bucket_name != "" ? var.prod_frontend_bucket_name : null
  bucket_prefix = var.prod_frontend_bucket_name == "" ? "recruiterreply-prod-frontend-" : null
}

resource "aws_s3_bucket_ownership_controls" "prod_frontend" {
  count = var.create_cloudfront_distribution ? 1 : 0

  bucket = aws_s3_bucket.prod_frontend[0].id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "prod_frontend" {
  count = var.create_cloudfront_distribution ? 1 : 0

  bucket                  = aws_s3_bucket.prod_frontend[0].id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_cloudfront_origin_access_control" "prod_frontend" {
  count = var.create_cloudfront_distribution ? 1 : 0

  name                              = "recruiterreply-prod-oac"
  description                       = "OAC for recruiterreply production frontend bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_acm_certificate" "prod_frontend" {
  count    = local.create_prod_certificate ? 1 : 0
  provider = aws.use1

  domain_name       = var.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "prod_frontend_cert_validation" {
  for_each = local.create_prod_certificate ? {
    for dvo in aws_acm_certificate.prod_frontend[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  allow_overwrite = true
  zone_id         = aws_route53_zone.root.zone_id
  name            = each.value.name
  type            = each.value.type
  ttl             = 60
  records         = [each.value.record]
}

resource "aws_acm_certificate_validation" "prod_frontend" {
  count    = local.create_prod_certificate ? 1 : 0
  provider = aws.use1

  certificate_arn         = aws_acm_certificate.prod_frontend[0].arn
  validation_record_fqdns = [for record in aws_route53_record.prod_frontend_cert_validation : record.fqdn]
}

resource "aws_cloudfront_distribution" "prod_frontend" {
  count = var.create_cloudfront_distribution ? 1 : 0

  enabled             = true
  is_ipv6_enabled     = true
  comment             = "recruiterreply production frontend"
  default_root_object = "index.html"
  aliases             = [var.domain_name]

  origin {
    domain_name              = aws_s3_bucket.prod_frontend[0].bucket_regional_domain_name
    origin_id                = "prod-frontend-s3-origin"
    origin_access_control_id = aws_cloudfront_origin_access_control.prod_frontend[0].id
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "prod-frontend-s3-origin"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    forwarded_values {
      query_string = false

      cookies {
        forward = "none"
      }
    }
  }

  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 60
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 60
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.prod_frontend[0].certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = var.cloudfront_tls_min_protocol_version
  }
}

data "aws_iam_policy_document" "prod_frontend_bucket_policy" {
  count = var.create_cloudfront_distribution ? 1 : 0

  statement {
    sid    = "AllowCloudFrontServicePrincipalReadOnly"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    actions = ["s3:GetObject"]

    resources = [
      "${aws_s3_bucket.prod_frontend[0].arn}/*"
    ]

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values = [
        "arn:aws:cloudfront::${data.aws_caller_identity.current.account_id}:distribution/${aws_cloudfront_distribution.prod_frontend[0].id}"
      ]
    }
  }
}

resource "aws_s3_bucket_policy" "prod_frontend" {
  count = var.create_cloudfront_distribution ? 1 : 0

  bucket = aws_s3_bucket.prod_frontend[0].id
  policy = data.aws_iam_policy_document.prod_frontend_bucket_policy[0].json
}

output "route53_hosted_zone_id" {
  description = "Hosted zone ID for the domain."
  value       = aws_route53_zone.root.zone_id
}

output "route53_name_servers" {
  description = "Name servers to set at Network Solutions for delegation."
  value       = aws_route53_zone.root.name_servers
}

output "prod_frontend_bucket_name" {
  description = "S3 bucket name used by the production CloudFront distribution."
  value       = var.create_cloudfront_distribution ? aws_s3_bucket.prod_frontend[0].bucket : null
}

output "prod_cloudfront_distribution_id" {
  description = "CloudFront distribution ID for production frontend."
  value       = var.create_cloudfront_distribution ? aws_cloudfront_distribution.prod_frontend[0].id : null
}

output "prod_cloudfront_domain_name" {
  description = "CloudFront domain name for production frontend."
  value       = var.create_cloudfront_distribution ? aws_cloudfront_distribution.prod_frontend[0].domain_name : null
}

output "prod_acm_certificate_arn" {
  description = "ACM certificate ARN attached to production CloudFront distribution."
  value       = local.create_prod_certificate ? aws_acm_certificate_validation.prod_frontend[0].certificate_arn : null
}
