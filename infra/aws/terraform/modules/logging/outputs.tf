output "backend_log_group_arns" {
  value = { for environment, group in aws_cloudwatch_log_group.backend : environment => group.arn }
}

output "backend_log_group_names" {
  value = { for environment, group in aws_cloudwatch_log_group.backend : environment => group.name }
}
