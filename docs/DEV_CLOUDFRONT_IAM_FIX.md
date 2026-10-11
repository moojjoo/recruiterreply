# Dev CloudFront invalidation waiter permission (#266)

GitHub Actions Dev deployment uses the AWS role `recruiterreply-github-actions-role`. The deploy job creates a CloudFront invalidation and then runs `aws cloudfront wait invalidation-completed`, which calls `cloudfront:GetInvalidation`.

Observed AccessDenied: run [38146772412](https://github.com/moojjoo/recruiterreply/actions/runs/38146772412), distribution `E2JWU1TLDA6YRS`.

## Terraform source of truth

`infra/aws/terraform/modules/github_oidc/main.tf` separates `cloudfront:GetInvalidation` from the existing broad `FrontendArtifactsAndCdn` statement and grants it only for:

```
arn:aws:cloudfront::178522450316:distribution/E2JWU1TLDA6YRS
```

This preserves the other permissions and the existing GitHub OIDC trust. **Caveat:** the existing broader statement still grants `cloudfront:CreateInvalidation` and `cloudfront:GetDistribution` on `*`; narrowing those requires a separate review, not this fix.

**Important:** The old Terraform source already listed `cloudfront:GetInvalidation` with `Resource = "*"`, but the deployed role denied it. That means the checked-in policy and actual IAM permissions are out of sync. Editing Terraform alone does not fix the deployed role. Verify the correct AWS account/state and use a reviewed Terraform plan to reconcile the live IAM role. Do not apply unrelated drift in the shared `global` root.

## Deployment procedure (operator with AWS permissions)

```bash
cd infra/aws/terraform/global
terraform init
terraform fmt -check -recursive
terraform validate
terraform plan -out=dev-cloudfront-iam.tfplan
terraform show dev-cloudfront-iam.tfplan
# Apply only after confirming the plan changes the intended GitHub role policy
# and does not modify other environments or resources.
terraform apply dev-cloudfront-iam.tfplan
```

Confirm the role is authorized:

```bash
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::178522450316:role/recruiterreply-github-actions-role \
  --action-names cloudfront:GetInvalidation \
  --resource-arns arn:aws:cloudfront::178522450316:distribution/E2JWU1TLDA6YRS \
  --query 'EvaluationResults[].EvalDecision'
```

Expected result: `allowed`. IAM simulator permissions are separate from the deploy role's permissions; if unavailable, run the actual Dev workflow and inspect the CloudFront waiter.

Then rerun **Dev only** `Build and Deploy to Dev` on the approved `main` SHA. Verify invalidation completes and backend/frontend health checks pass. Do not promote to Test or Production. If the global Terraform state is not reconciled/imported yet, **do not apply** until the state is reviewed; see `infra/aws/terraform/MIGRATION.md`.

No AWS policy was applied by this repository change alone.
