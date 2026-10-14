terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 6.0"
    }
  }
}

variable "environment" {
  type = string
  validation {
    condition     = contains(["dev", "test"], var.environment)
    error_message = "Only dev and test may use the private edge function."
  }
}

variable "name_prefix" {
  type    = string
  default = "recruiterreply"
}

variable "package_file" {
  description = "Reviewed Lambda ZIP produced from the locked private-auth staging directory."
  type        = string
}

variable "signing_key_secret_arn" {
  type = string
  validation {
    condition     = can(regex("^arn:aws:secretsmanager:us-east-1:[0-9]{12}:secret:", var.signing_key_secret_arn))
    error_message = "Signing keys must use an explicit us-east-1 Secrets Manager ARN."
  }
}

variable "replay_table_arn" {
  type = string
  validation {
    condition     = can(regex("^arn:aws:dynamodb:us-east-1:[0-9]{12}:table/", var.replay_table_arn))
    error_message = "Replay state must use an explicit us-east-1 DynamoDB table ARN."
  }
}

data "aws_caller_identity" "current" {}

data "aws_iam_policy_document" "assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com", "edgelambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "edge" {
  name               = "${var.name_prefix}-${var.environment}-private-edge"
  assume_role_policy = data.aws_iam_policy_document.assume_role.json
}

data "aws_iam_policy_document" "edge" {
  statement {
    sid       = "ReadSigningKeys"
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [var.signing_key_secret_arn]
  }

  statement {
    sid       = "ClaimOAuthTransactions"
    effect    = "Allow"
    actions   = ["dynamodb:PutItem"]
    resources = [var.replay_table_arn]
  }

  statement {
    sid       = "CreateEdgeLogGroups"
    effect    = "Allow"
    actions   = ["logs:CreateLogGroup"]
    resources = ["arn:aws:logs:*:${data.aws_caller_identity.current.account_id}:*"]
  }

  statement {
    sid     = "WriteEdgeLogs"
    effect  = "Allow"
    actions = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = [
      "arn:aws:logs:*:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/us-east-1.${var.name_prefix}-${var.environment}-private-edge:*",
    ]
  }
}

resource "aws_iam_role_policy" "edge" {
  name   = "${var.name_prefix}-${var.environment}-private-edge"
  role   = aws_iam_role.edge.id
  policy = data.aws_iam_policy_document.edge.json
}

resource "aws_lambda_function" "edge" {
  function_name    = "${var.name_prefix}-${var.environment}-private-edge"
  description      = "Fail-closed ${var.environment} CloudFront authentication gateway"
  filename         = var.package_file
  source_code_hash = filebase64sha256(var.package_file)
  role             = aws_iam_role.edge.arn
  handler          = "index.handler"
  runtime          = "nodejs24.x"
  architectures    = ["x86_64"]
  memory_size      = 128
  timeout          = 5
  publish          = true

  depends_on = [aws_iam_role_policy.edge]

  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Environment = var.environment
    Purpose     = "private-edge-auth"
  }
}

output "qualified_arn" {
  description = "Numbered Lambda version ARN required by CloudFront."
  value       = aws_lambda_function.edge.qualified_arn
}

output "version" {
  value = aws_lambda_function.edge.version
}
