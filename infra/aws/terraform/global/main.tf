data "aws_caller_identity" "current" {}

# Account-wide GitHub Actions OIDC trust + deploy role, shared by deploy-dev.yml,
# deploy-test.yml, and deploy-prod.yml. Not environment-scoped, so it lives here
# rather than in envs/*.
module "github_oidc" {
  source = "../modules/github_oidc"

  name_prefix    = var.app_name
  github_repo    = var.github_repo
  aws_account_id = data.aws_caller_identity.current.account_id
}

# Frontend S3 buckets + CloudFront distributions for all three environments.
# This module already fans out per environment internally (for_each over
# frontend_bucket_names), so it stays a single global apply rather than being
# split into envs/dev, envs/test, envs/prod.
module "frontend" {
  source = "../modules/frontend"

  create_buckets        = var.create_frontend_buckets
  frontend_bucket_names = var.frontend_bucket_names
  aws_account_id        = data.aws_caller_identity.current.account_id
}
