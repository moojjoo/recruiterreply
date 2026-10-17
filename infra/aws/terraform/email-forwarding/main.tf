# Isolated state: this root owns only the two apex email record sets.
terraform {
  required_version = ">= 1.14.3"
  backend "s3" {
    bucket               = "recruiterreply-terraform-state-178522450316"
    key                  = "recruiterreply/email-forwarding/terraform.tfstate"
    region               = "us-east-1"
    use_lockfile         = true
    encrypt              = true
    workspace_key_prefix = "recruiterreply/email-forwarding/workspaces"
  }
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.58"
    }
  }
}

provider "aws" {
  region              = "us-east-1"
  allowed_account_ids = ["178522450316"]
}

locals {
  zone_id = "Z03382853SGMP0RST8DJG"
  domain  = "recruiterreply.com"
}

# Import preserves the existing verification TXT, rather than overwriting an
# unmanaged record. Never manage this record in a second Terraform state.
import {
  to = aws_route53_record.apex_txt
  id = "Z03382853SGMP0RST8DJG_recruiterreply.com_TXT"
}

resource "aws_route53_record" "apex_txt" {
  zone_id = local.zone_id
  name    = local.domain
  type    = "TXT"
  ttl     = 300
  records = [
    "google-site-verification=aC6yYtwq8VhDHCvPK9lL_QyfhMTjwyIcRSWLBiysRa0",
    "v=spf1 include:amazonses.com include:spf.improvmx.com ~all",
  ]
  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_route53_record" "mx" {
  zone_id = local.zone_id
  name    = local.domain
  type    = "MX"
  ttl     = 300
  records = ["10 mx1.improvmx.com", "20 mx2.improvmx.com"]
  lifecycle {
    prevent_destroy = true
  }
}
