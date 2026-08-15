# Provisions the container for the backend's runtime secrets (JWT key, OpenAI API key,
# Gmail OAuth client credentials, DB connection string). Deliberately does NOT create an
# aws_secretsmanager_secret_version — populate the actual value out-of-band via:
#   aws secretsmanager put-secret-value --secret-id <name> --secret-string file://secret.json
# so the plaintext never lands in Terraform state.

resource "aws_secretsmanager_secret" "backend" {
  name                    = "${var.name_prefix}-backend"
  description             = "RecruiterReply backend runtime config (Jwt, OpenAI, Gmail, ConnectionStrings) for ${var.name_prefix}."
  recovery_window_in_days = var.recovery_window_in_days
}

data "aws_iam_policy_document" "read_secret" {
  statement {
    actions   = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
    resources = [aws_secretsmanager_secret.backend.arn]
  }
}

resource "aws_iam_role_policy" "read_backend_secret" {
  name   = "${var.name_prefix}-read-backend-secret"
  role   = var.ec2_role_name
  policy = data.aws_iam_policy_document.read_secret.json
}
