locals {
  buckets = var.create_buckets ? var.frontend_bucket_names : {}

  origin_bucket_names = {
    for key, bucket in aws_s3_bucket.this :
    key => bucket.id
  }

  origin_bucket_domains = {
    for key, bucket in aws_s3_bucket.this :
    key => bucket.bucket_regional_domain_name
  }

  origin_bucket_arns = {
    for key, bucket in aws_s3_bucket.this :
    key => bucket.arn
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

# Dev-only SPA rewrite: resolve client-side routes to index.html before S3 is queried.
# Preserve real files, SEO prerendered pages, robots.txt, and sitemap.xml.
resource "aws_cloudfront_function" "dev_spa_rewrite" {
  for_each = { for key, bucket in aws_s3_bucket.this : key => bucket if key == "dev" }
  name    = "recruiterreply-dev-spa-rewrite"
  runtime = "cloudfront-js-2.0"
  comment = "Rewrite Dev SPA routes to index.html before S3 lookup"
  publish = true
  code    = <<-JS
    function handler(event) {
      var request = event.request;
      var uri = request.uri;
      // Leave the homepage and file-like paths (including SEO pages) untouched.
      if (uri === '/' || uri.substring(uri.lastIndexOf('/') + 1).includes('.')) return request;
      // Rewrite client-side paths and unknown extensionless paths to the SPA shell.
      request.uri = '/index.html';
      return request;
    }
  JS
}

# Viewer-response function adds noindex to normal Dev/Test responses.
# CloudFront viewer-response functions do not run for origin error responses.
# CloudFront Functions cannot run on viewer-response for origin 4xx/5xx; error
# responses require separate validation and potentially response-headers policy.
resource "aws_cloudfront_function" "noindex" {
  for_each = { for key, bucket in aws_s3_bucket.this : key => bucket if contains(["dev", "test"], key) }
  name    = "recruiterreply-${each.key}-noindex"
  runtime = "cloudfront-js-2.0"
  comment = "Prevent indexing of ${each.key} environment"
  publish = true
  code    = <<-JS
    function handler(event) {
      var response = event.response;
      response.headers['x-robots-tag'] = {value: 'noindex, nofollow'};
      return response;
    }
  JS
}

# Defense-in-depth for non-production distributions. Unlike viewer-response
# functions, a response-headers policy is evaluated for CloudFront responses
# even when the origin returns an error. Never associate with production.
resource "aws_cloudfront_response_headers_policy" "noindex" {
  for_each = { for key, bucket in aws_s3_bucket.this : key => bucket if contains(["dev", "test"], key) }
  name     = "recruiterreply-${each.key}-noindex"
  comment  = "Prevent search indexing of ${each.key} frontend"

  custom_headers_config {
    items {
      header   = "X-Robots-Tag"
      value    = "noindex, nofollow"
      override = true
    }
  }
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
    response_headers_policy_id = contains(["dev", "test"], each.key) ? aws_cloudfront_response_headers_policy.noindex[each.key].id : null
    dynamic "function_association" {
      for_each = each.key == "dev" ? [1] : []
      content {
        event_type   = "viewer-request"
        function_arn = aws_cloudfront_function.dev_spa_rewrite[each.key].arn
      }
    }
    dynamic "function_association" {
      for_each = contains(["dev", "test"], each.key) ? [1] : []
      content {
        event_type   = "viewer-response"
        function_arn = aws_cloudfront_function.noindex[each.key].arn
      }
    }
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
