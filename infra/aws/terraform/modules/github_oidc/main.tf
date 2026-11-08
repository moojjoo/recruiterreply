# Brings the GitHub Actions OIDC trust (created out-of-band via console/CLI) under Terraform
# management so `terraform plan` reflects reality instead of silently ignoring it.

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["22ff89586561fc2d52f77491e9f1eff1b80be33e"]
}

resource "aws_iam_role" "github_actions" {
  name = "${var.name_prefix}-github-actions-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = "sts:AssumeRoleWithWebIdentity"
      Principal = {
        Federated = "arn:aws:iam::${var.aws_account_id}:oidc-provider/token.actions.githubusercontent.com"
      }
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          "token.actions.githubusercontent.com:sub" = [for environment in var.github_environments : "repo:${var.github_repo}:environment:${environment}"]
        }
      }
    }]
  })
  max_session_duration = 3600
}

resource "aws_iam_role_policy" "github_actions_deploy" {
  name = "RecruiterReplyGithubActionsDeployPolicy"
  role = aws_iam_role.github_actions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "EcrPushPull"
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        Sid    = "EcrPushPullBackend"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:BatchGetImage",
          "ecr:CompleteLayerUpload",
          "ecr:DescribeImages",
          "ecr:DescribeRepositories",
          "ecr:GetDownloadUrlForLayer",
          "ecr:InitiateLayerUpload",
          "ecr:ListImages",
          "ecr:PutImage",
          "ecr:UploadLayerPart",
        ]
        Resource = "arn:aws:ecr:${var.aws_region}:${var.aws_account_id}:repository/recruiterreply-backend"
      },
      {
        Sid    = "EcrRetentionBackend"
        Effect = "Allow"
        Action = [
          "ecr:BatchDeleteImage",
          "ecr:DescribeImages",
        ]
        Resource = "arn:aws:ecr:${var.aws_region}:${var.aws_account_id}:repository/recruiterreply-backend"
      },
      {
        Sid      = "FrontendBucketListing"
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = [for bucket in values(var.frontend_bucket_names) : "arn:aws:s3:::${bucket}"]
      },
      {
        Sid    = "FrontendObjectSync"
        Effect = "Allow"
        Action = [
          "s3:DeleteObject",
          "s3:GetObject",
          "s3:PutObject",
        ]
        Resource = [for bucket in values(var.frontend_bucket_names) : "arn:aws:s3:::${bucket}/*"]
      },
      {
        Sid    = "CloudFrontDeployment"
        Effect = "Allow"
        Action = [
          "cloudfront:CreateInvalidation",
          "cloudfront:GetDistribution",
          "cloudfront:GetInvalidation",
        ]
        Resource = [for distribution_id in values(var.cloudfront_distribution_ids) : "arn:aws:cloudfront::${var.aws_account_id}:distribution/${distribution_id}"]
      },
      {
        Sid    = "SsmSendCommandToRecruiterReplyHost"
        Effect = "Allow"
        Action = ["ssm:SendCommand"]
        Resource = [
          "arn:aws:ec2:${var.aws_region}:${var.aws_account_id}:instance/${var.ec2_instance_id}",
          "arn:aws:ssm:${var.aws_region}::document/AWS-RunShellScript",
        ]
      },
      {
        Sid      = "SsmCommandStatus"
        Effect   = "Allow"
        Action   = ["ssm:GetCommandInvocation"]
        Resource = "arn:aws:ssm:${var.aws_region}:${var.aws_account_id}:command/*"
      },
      {
        Sid      = "SsmHostDiscovery"
        Effect   = "Allow"
        Action   = ["ssm:DescribeInstanceInformation", "ssm:ListCommandInvocations"]
        Resource = "*"
      },
    ]
  })
}
