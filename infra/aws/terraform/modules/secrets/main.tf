# Look up the existing per-environment backend secret. Terraform must not create,
# replace, or read secret values; only its metadata/ARN is required for IAM.
data "aws_secretsmanager_secret" "backend" {
  name = var.backend_secret_name
}

data "aws_iam_policy_document" "read_secret" {
  statement {
    actions   = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
    resources = [data.aws_secretsmanager_secret.backend.arn]
  }
}

resource "aws_iam_role_policy" "read_backend_secret" {
  name   = "${var.name_prefix}-read-backend-secret"
  role   = var.ec2_role_name
  policy = data.aws_iam_policy_document.read_secret.json
}
