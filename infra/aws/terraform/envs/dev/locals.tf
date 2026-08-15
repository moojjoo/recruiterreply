locals {
  name_prefix = "${var.app_name}-${var.environment}"

  common_tags = merge(
    {
      Application = var.app_name
      Environment = var.environment
      ManagedBy   = "terraform"
    },
    var.tags
  )

  ec2_user_data = <<-EOT
    #!/bin/bash
    set -euxo pipefail

    apt-get update -y
    apt-get upgrade -y
    apt-get install -y docker.io docker-compose-v2 nginx certbot python3-certbot-nginx awscli

    systemctl enable docker
    systemctl start docker

    usermod -aG docker ubuntu || true

    mkdir -p /home/ubuntu/recruiterreply
    chown -R ubuntu:ubuntu /home/ubuntu/recruiterreply
  EOT
}
