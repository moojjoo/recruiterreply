output "instance_id" {
  value = aws_instance.this.id
}

output "public_ip" {
  description = "Public IPv4 address, using the Elastic IP when enabled."
  value       = var.enable_elastic_ip ? aws_eip.this[0].public_ip : aws_instance.this.public_ip
}

output "elastic_ip" {
  description = "Elastic IP address when enabled; otherwise null."
  value       = var.enable_elastic_ip ? aws_eip.this[0].public_ip : null
}

output "public_dns" {
  value = aws_instance.this.public_dns
}

output "role_name" {
  value = aws_iam_role.ec2.name
}

output "role_arn" {
  value = aws_iam_role.ec2.arn
}
