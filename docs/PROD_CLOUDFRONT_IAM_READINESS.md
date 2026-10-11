# Production CloudFront IAM readiness (issue #286)

## Confirmed from repository
- `.github/workflows/promote-prod.yml` selects the latest successful **Test** deployment SHA and calls `.github/workflows/promote.yml` with `environment: prod`.
- The shared workflow assumes the AWS role from environment/repository `AWS_ROLE_TO_ASSUME` or `AWS_ROLE_ARN` (or falls back to configured access keys). **The actual Production principal must be verified in GitHub environment configuration or AWS STS output.**
- The shared workflow reads the environment-specific `CLOUDFRONT_DISTRIBUTION_ID`, calls `cloudfront:CreateInvalidation`, and waits via `cloudfront:GetInvalidation`.
- Terraform PR #285 (issue #284) proposes `cloudfront:GetInvalidation` on `arn:aws:cloudfront::${var.aws_account_id}:distribution/*`. This includes Production **only when the AWS account and assumed role match**. Avoid duplicate IAM statements.

## Preflight — no deployment
1. Record the GitHub `prod` environment's `AWS_ROLE_TO_ASSUME` / `AWS_ROLE_ARN`, `AWS_REGION`, and `CLOUDFRONT_DISTRIBUTION_ID` without exposing credentials. Verify AWS account ID and role with `aws sts get-caller-identity` using the same Production deployment identity.
2. Verify the distribution exists with `aws cloudfront get-distribution --id "$CLOUDFRONT_DISTRIBUTION_ID"` under the deployment identity.
3. Review the Terraform plan for PR #285 against the **live** IAM role, checking that only the intended `cloudfront:GetInvalidation` resource scope changes and there is no resource replacement or destruction. Do not treat a merged PR as an applied IAM policy.
4. Obtain explicit approval before `terraform apply`. After apply, verify effective permissions using an authorized IAM simulation or a controlled `GetInvalidation` call on a **known existing invalidation ID** for the Production distribution; do not trigger an invalidation during preflight.
5. Confirm Test promotion succeeds before approving Production. Production promotion must retain its existing explicit environment approval and SHA provenance. After approved promotion, check the CloudFront waiter and smoke tests.

## Acceptance evidence
- Production distribution ID, account and actual deployment principal
- Terraform plan and reviewed approval; apply result
- Read-only permission check after IAM reconciliation
- Successful Test deployment and separately approved Production run

No Terraform apply, GitHub Actions dispatch, or Production deployment is authorized by this document.
