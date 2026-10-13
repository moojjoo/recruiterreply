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
  statement {
    sid = "ReadAwsInventory"
    actions = [
      "cloudfront:Get*",
      "cloudfront:List*",
      "ec2:Describe*",
      "iam:Get*",
      "iam:List*",
      "s3:GetBucket*",
      "s3:GetAccelerateConfiguration",
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
