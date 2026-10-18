output "resource_identifier" {
  value = aws_cognito_resource_server.api.identifier
}

output "bff_client_id" {
  value = aws_cognito_user_pool_client.bff.id
}

output "bff_client_secret" {
  value     = aws_cognito_user_pool_client.bff.client_secret
  sensitive = true
}

output "machine_clients" {
  value = {
    ci = {
      id     = aws_cognito_user_pool_client.ci.id
      secret = aws_cognito_user_pool_client.ci.client_secret
    }
    worker = {
      id     = aws_cognito_user_pool_client.worker.id
      secret = aws_cognito_user_pool_client.worker.client_secret
    }
    ops = {
      id     = aws_cognito_user_pool_client.ops.id
      secret = aws_cognito_user_pool_client.ops.client_secret
    }
  }
  sensitive = true
}
