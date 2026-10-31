# Separate GitHub Actions identity for manual, read-only Terraform drift inspection.
# No permissions to apply, import, write Terraform state, or alter AWS resources.
data "aws_iam_policy_document" "terraform_audit_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/token.actions.githubusercontent.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repo}:environment:terraform-readonly-audit"]
    }
  }
}

resource "aws_iam_role" "terraform_audit" {
  name                 = "${var.app_name}-terraform-audit-role"
  assume_role_policy   = data.aws_iam_policy_document.terraform_audit_assume.json
  max_session_duration = 3600
}

# Deliberate allowlist of the deployed, public-client Dev/Test pools. Keep audit
# reads working even when the opt-in identity modules are disabled in a plan.
# Pool replacements require reviewing and updating this metadata allowlist.
locals {
  terraform_audit_private_user_pool_ids = [
    "us-east-1_bMcYQWq8U",
    "us-east-1_OUaaIhK6h",
  ]
  terraform_audit_private_environments = ["dev", "test"]
}

data "aws_iam_policy_document" "terraform_audit" {
  statement {
    sid = "ReadTerraformState"
    actions = [
      "s3:GetObject",
      "s3:GetBucketLocation",
      "s3:ListBucket",
    ]
    resources = [
      "arn:aws:s3:::recruiterreply-terraform-state-${data.aws_caller_identity.current.account_id}",
      "arn:aws:s3:::recruiterreply-terraform-state-${data.aws_caller_identity.current.account_id}/recruiterreply/*",
    ]
  }
  # DescribeUserPoolClient can return client secrets. These exact pools are
  # reviewed public browser clients (generate_secret=false), not machine clients.
  statement {
    sid = "ReadPrivateUserPoolMetadata"
    actions = [
      "cognito-idp:DescribeUserPool",
      "cognito-idp:DescribeUserPoolClient",
      "cognito-idp:GetUserPoolMfaConfig",
      "cognito-idp:ListTagsForResource",
    ]
    resources = [
      for id in local.terraform_audit_private_user_pool_ids :
      "arn:aws:cognito-idp:${var.aws_region}:${data.aws_caller_identity.current.account_id}:userpool/${id}"
    ]
  }
  # AWS does not support resource-level scoping for DescribeUserPoolDomain.
  statement {
    sid       = "ReadPrivateUserPoolDomains"
    actions   = ["cognito-idp:DescribeUserPoolDomain"]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = [var.aws_region]
    }
  }
  statement {
    sid = "ReadPrivateEdgeFunctionMetadata"
    actions = [
      "lambda:GetFunction",
      "lambda:GetFunctionCodeSigningConfig",
      "lambda:ListTags",
      "lambda:ListVersionsByFunction",
    ]
    resources = [
      for env in local.terraform_audit_private_environments :
      "arn:aws:lambda:${var.aws_region}:${data.aws_caller_identity.current.account_id}:function:${var.app_name}-${env}-private-edge"
    ]
  }
  statement {
    sid = "ReadPrivateReplayTableMetadata"
    actions = [
      "dynamodb:DescribeTable",
      "dynamodb:DescribeContinuousBackups",
      "dynamodb:DescribeTimeToLive",
      "dynamodb:ListTagsOfResource",
    ]
    resources = [
      for env in local.terraform_audit_private_environments :
      "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.app_name}-${env}-oauth-replay"
    ]
  }
  statement {
    sid = "ReadAwsInventory"
    actions = [
      "cloudfront:Get*",
      "cloudfront:DescribeFunction",
      "cloudfront:List*",
      "ec2:Describe*",
      "iam:Get*",
      "iam:List*",
      "s3:GetBucket*",
      "s3:GetAccelerateConfiguration",
      "s3:GetEncryptionConfiguration",
      "s3:GetLifecycleConfiguration",
      "s3:GetReplicationConfiguration",
      "s3:ListAllMyBuckets",
      "s3:ListBucket",
      "secretsmanager:DescribeSecret",
      "secretsmanager:GetResourcePolicy",
      "secretsmanager:ListSecrets",
      "ssm:Describe*",
      "ssm:List*",
      "route53:Get*",
      "route53:List*",
      "acm:DescribeCertificate",
      "acm:ListCertificates",
      "ecr:Describe*",
      "ecr:List*",
      "kms:DescribeKey",
      "kms:ListKeys",
      "kms:ListAliases",
      "sts:GetCallerIdentity",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "terraform_audit" {
  name   = "RecruiterReplyTerraformReadOnlyAudit"
  role   = aws_iam_role.terraform_audit.id
  policy = data.aws_iam_policy_document.terraform_audit.json
}
