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
  terraform_audit_private_environments     = ["dev", "test"]
  terraform_audit_bff_session_environments = ["dev", "test", "prod"]
}

data "aws_kms_alias" "terraform_audit_bff_session" {
  for_each = toset(local.terraform_audit_bff_session_environments)
  name     = "alias/${var.app_name}-${each.key}-bff-sessions"
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
      "cognito-idp:DescribeResourceServer",
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
  # ListTagsForCertificate supports certificate resource scoping, so grant it
  # only for certificates managed by the frontend module.
  dynamic "statement" {
    for_each = length(module.frontend.certificate_arns) > 0 ? [1] : []
    content {
      sid       = "ReadManagedCertificateTags"
      actions   = ["acm:ListTagsForCertificate"]
      resources = module.frontend.certificate_arns
    }
  }
  # GetKeyPolicy supports key resource scoping. Resolve existing aliases rather
  # than depending on the optional creation module, which is disabled in the
  # reviewed global inputs while these deployed keys remain in state.
  statement {
    sid = "ReadManagedBffSessionKeyPolicies"
    actions = [
      "kms:GetKeyPolicy",
      "kms:GetKeyRotationStatus",
      "kms:ListResourceTags",
    ]
    resources = [for alias in data.aws_kms_alias.terraform_audit_bff_session : alias.target_key_arn]
  }
  # DescribeLogGroups is an account-level list operation and does not support
  # resource-level permissions. Restrict its wildcard grant to the configured region.
  statement {
    sid       = "ListRegionalCloudWatchLogGroups"
    actions   = ["logs:DescribeLogGroups"]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = [var.aws_region]
    }
  }
  statement {
    sid     = "ReadManagedCloudWatchLogGroupTags"
    actions = ["logs:ListTagsForResource"]
    resources = [
      for env in ["dev", "test", "prod"] :
      "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/recruiterreply/${env}/backend"
    ]
  }
  # DescribeMetricFilters is a list operation over log groups. AWS requires
  # the regional log-group resource form for this provider read.
  statement {
    sid       = "ReadRegionalCloudWatchMetricFilters"
    actions   = ["logs:DescribeMetricFilters"]
    resources = ["arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:*"]
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
    sid = "ReadBffSessionTableMetadata"
    actions = [
      "dynamodb:DescribeContinuousBackups",
      "dynamodb:DescribeTable",
    ]
    resources = [
      for env in local.terraform_audit_bff_session_environments :
      "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.app_name}-${env}-bff-sessions"
    ]
  }
  statement {
    sid = "ReadBudgetMetadata"
    actions = [
      "budgets:ListTagsForResource",
      "budgets:ViewBudget",
    ]
    resources = [
      "arn:aws:budgets::${data.aws_caller_identity.current.account_id}:budget/${aws_budgets_budget.cloudwatch_observability.name}",
    ]
  }
  statement {
    sid = "ReadFrontendAndBackupBucketTags"
    actions = [
      "s3:ListTagsForResource",
    ]
    resources = concat(
      values(module.frontend.bucket_arns),
      [aws_s3_bucket.postgres_backups.arn],
    )
  }
  statement {
    sid = "ReadObservabilityAlarmMetadata"
    actions = [
      "cloudwatch:DescribeAlarms",
    ]
    resources = [
      for env in ["dev", "test", "prod"] :
      "arn:aws:cloudwatch:${var.aws_region}:${data.aws_caller_identity.current.account_id}:alarm:${var.app_name}-${env}-unhandled-errors"
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
