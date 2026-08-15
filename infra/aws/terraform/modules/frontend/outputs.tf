output "bucket_names" {
  value = {
    for key, bucket in aws_s3_bucket.this : key => bucket.id
  }
}

output "bucket_arns" {
  value = {
    for key, bucket in aws_s3_bucket.this : key => bucket.arn
  }
}

output "cloudfront_distribution_ids" {
  value = {
    for key, dist in aws_cloudfront_distribution.this : key => dist.id
  }
}

output "cloudfront_domain_names" {
  value = {
    for key, dist in aws_cloudfront_distribution.this : key => dist.domain_name
  }
}
