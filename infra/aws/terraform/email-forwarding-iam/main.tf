# Separate owner-approved IAM bootstrap. Does not provision DNS or replace the existing OIDC provider.
terraform {
  required_version = ">= 1.14.3"
  backend "s3" {
    bucket       = "recruiterreply-terraform-state-178522450316"
    key          = "recruiterreply/email-forwarding-iam/terraform.tfstate"
    region       = "us-east-1"
    use_lockfile = true
    encrypt      = true
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

data "aws_caller_identity" "current" {}

locals {
  email_forwarding_environments = {
    Dev = "dev-plan", Test = "test-plan", Prod = "prod-apply", ProdPlan = "prod-plan"
  }
  email_forwarding_state_bucket = "recruiterreply-terraform-state-178522450316"
  email_forwarding_state_key    = "recruiterreply/email-forwarding/terraform.tfstate"
}

resource "aws_iam_role" "email_forwarding" {
  for_each             = local.email_forwarding_environments
  name                 = "RecruiterReply-Terraform-${each.key}"
  max_session_duration = 3600
  lifecycle {
    prevent_destroy = true
  }
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = "sts:AssumeRoleWithWebIdentity"
      Principal = {
        Federated = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/token.actions.githubusercontent.com"
      }
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          "token.actions.githubusercontent.com:sub" = ["repo:moojjoo/recruiterreply:environment:terraform-email-${each.value}"]
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "email_forwarding" {
  for_each = local.email_forwarding_environments
  name     = "Issue400EmailDnsOnly"
  lifecycle {
    prevent_destroy = true
  }
  role = aws_iam_role.email_forwarding[each.key].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat([
      {
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = "arn:aws:s3:::${local.email_forwarding_state_bucket}"
        Condition = {
          StringLike = { "s3:prefix" = [local.email_forwarding_state_key, "${local.email_forwarding_state_key}.tflock", "recruiterreply/email-forwarding/workspaces/"] }
        }
      },
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject"]
        Resource = "arn:aws:s3:::${local.email_forwarding_state_bucket}/${local.email_forwarding_state_key}"
      },
      {
        Effect   = "Allow"
        Action   = ["route53:GetHostedZone", "route53:ListResourceRecordSets"]
        Resource = "arn:aws:route53:::hostedzone/Z03382853SGMP0RST8DJG"
      },
      {
        Effect   = "Allow"
        Action   = ["ses:GetEmailIdentity"]
        Resource = "arn:aws:ses:us-east-1:${data.aws_caller_identity.current.account_id}:identity/recruiterreply.com"
      },
      {
        Effect   = "Allow"
        Action   = ["route53:GetChange"]
        Resource = "arn:aws:route53:::change/*"
      },
      ], [for statement in [
        {
          Effect   = "Allow"
          Action   = ["s3:PutObject"]
          Resource = "arn:aws:s3:::${local.email_forwarding_state_bucket}/${local.email_forwarding_state_key}"
        },
        {
          Effect   = "Allow"
          Action   = ["ses:SendEmail"]
          Resource = "arn:aws:ses:us-east-1:${data.aws_caller_identity.current.account_id}:identity/recruiterreply.com"
          Condition = {
            StringEquals = { "ses:FromAddress" = "no-reply@recruiterreply.com" }
            "ForAllValues:StringLike" = {
              "ses:Recipients" = ["privacy@recruiterreply.com", "legal@recruiterreply.com", "rr400-catchall-*@recruiterreply.com"]
            }
          }
        },
        {
          Effect   = "Allow"
          Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
          Resource = "arn:aws:s3:::${local.email_forwarding_state_bucket}/${local.email_forwarding_state_key}.tflock"
        },
        {
          Effect   = "Allow"
          Action   = ["route53:ChangeResourceRecordSets"]
          Resource = "arn:aws:route53:::hostedzone/Z03382853SGMP0RST8DJG"
          Condition = {
            "ForAllValues:StringEquals" = {
              "route53:ChangeResourceRecordSetsNormalizedRecordNames" = ["recruiterreply.com"]
              "route53:ChangeResourceRecordSetsRecordTypes"           = ["MX", "TXT"]
              "route53:ChangeResourceRecordSetsActions"               = ["CREATE", "UPSERT"]
            }
          }
        },
    ] : statement if each.key == "Prod"])
  })
}
