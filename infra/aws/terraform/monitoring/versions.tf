terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  # Deliberately no backend block: configure a separate state backend only after
  # review. Never reuse the unreconciled application Terraform state.
}

provider "aws" {
  region = var.aws_region
}
