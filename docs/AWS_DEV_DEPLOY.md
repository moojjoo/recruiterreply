# AWS DEV Deployment Setup (Webhook via GitHub Actions)

This guide sets up automatic deployment to AWS DEV when you push to the `dev` branch.

## What This Repo Now Includes

- Workflow: `.github/workflows/deploy-dev.yml`
- Bootstrap script: `scripts/aws/bootstrap_dev.sh`

The workflow does:
1. Build frontend and backend Docker images
2. Push to ECR
3. Trigger ECS service rolling deploy (`--force-new-deployment`)

## 1) Prerequisites

- AWS CLI installed and configured in WSL
- Docker available in GitHub Actions (default)
- GitHub repo connected (already done)

Verify AWS identity:

```bash
aws sts get-caller-identity
```

## 2) Bootstrap AWS DEV Base Resources

Run:

```bash
chmod +x scripts/aws/bootstrap_dev.sh
AWS_REGION=us-east-1 scripts/aws/bootstrap_dev.sh
```

This creates/verifies:
- ECR repos for frontend/backend
- ECS cluster (`recruiterreply-dev` by default)
- CloudWatch log groups
- OpenAI secret placeholder in Secrets Manager

## 3) Create ECS Services (One-Time)

Create two ECS Fargate services in the `recruiterreply-dev` cluster:
- Frontend service (container port 80)
- Backend service (container port 8080)

Use `dev-latest` tags for initial task definitions:
- `<account>.dkr.ecr.<region>.amazonaws.com/recruiterreply-frontend:dev-latest`
- `<account>.dkr.ecr.<region>.amazonaws.com/recruiterreply-backend:dev-latest`

Configure backend task definition to read OpenAI key from Secrets Manager.

Recommended routing:
- `/api/*` -> backend target group
- `/*` -> frontend target group

## 4) Configure GitHub OIDC Role in AWS

Create an IAM role trusted by GitHub OIDC for this repository.
Attach permissions for:
- ECR push/pull
- ECS update-service + describe
- CloudWatch logs read (optional)
- `iam:PassRole` for ECS task roles

## 5) Add GitHub Repository Secrets

In GitHub repo -> Settings -> Secrets and variables -> Actions, add:

- `AWS_ROLE_TO_ASSUME` (OIDC role ARN)
- `AWS_REGION` (for example `us-east-1`)
- `ECS_CLUSTER` (for example `recruiterreply-dev`)
- `ECS_FRONTEND_SERVICE` (your ECS frontend service name)
- `ECS_BACKEND_SERVICE` (your ECS backend service name)

## 6) Trigger Webhook Deployment

The workflow triggers on push to `dev`.

```bash
git checkout -b dev
git push -u origin dev
```

For future deploys:

```bash
git add .
git commit -m "Deploy change"
git push origin dev
```

## 7) Troubleshooting

- If workflow fails at AWS auth: validate `AWS_ROLE_TO_ASSUME` and OIDC trust policy.
- If ECS does not roll: check service names and cluster secret values.
- If backend fails at runtime: verify secret value and task definition secret mapping.
- If app loads but API fails: verify ALB route `/api/*` to backend target group.
