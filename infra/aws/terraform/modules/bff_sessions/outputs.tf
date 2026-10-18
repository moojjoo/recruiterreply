output "table_names" {
  value = { for environment, table in aws_dynamodb_table.sessions : environment => table.name }
}

output "table_arns" {
  value = { for environment, table in aws_dynamodb_table.sessions : environment => table.arn }
}

output "kms_key_arns" {
  value = { for environment, key in aws_kms_key.sessions : environment => key.arn }
}

output "iam_policy_fragments" {
  description = "Per-environment permissions to attach to the corresponding backend role after review."
  value = {
    for environment, table in aws_dynamodb_table.sessions : environment => {
      dynamodb_resources = [table.arn]
      kms_resources      = [aws_kms_key.sessions[environment].arn]
    }
  }
}
