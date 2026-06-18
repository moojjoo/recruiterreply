# AWS DEV Deployment Setup (Webhook to EKS via GitHub Actions)

This guide sets up automatic deployment to AWS DEV on EKS when you push to the dev branch.

## What This Repo Includes

- Workflow: .github/workflows/deploy-dev.yml
- EKS bootstrap script: scripts/aws/bootstrap_dev.sh
- GitHub OIDC role script: scripts/aws/create_github_oidc_role.sh
- DEV manifests: infra/k8s/dev

The workflow does:
1. Build frontend and backend images.
2. Push images to ECR.
3. Update kubeconfig for EKS.
4. Sync backend OpenAI key from AWS Secrets Manager to Kubernetes Secret.
5. Apply DEV manifests.
6. Set deployment images to the commit SHA and wait for rollout.

## 1) Prerequisites

- AWS CLI installed and configured in WSL.
- Existing EKS cluster for DEV.
- AWS Load Balancer Controller installed on the cluster.
- GitHub repo connected.

Verify AWS identity:

aws sts get-caller-identity

## 2) Bootstrap AWS DEV Base Resources

Run:

chmod +x scripts/aws/bootstrap_dev.sh
AWS_REGION=us-east-1 EKS_CLUSTER_NAME=recruiterreply-dev scripts/aws/bootstrap_dev.sh

This verifies or creates:
- ECR repos for frontend and backend.
- OpenAI secret placeholder in Secrets Manager.
- EKS cluster existence.

## 3) Create GitHub OIDC Role

Run:

chmod +x scripts/aws/create_github_oidc_role.sh
scripts/aws/create_github_oidc_role.sh moojjoo recruiterreply us-east-1 recruiterreply-github-actions-role

This script creates or updates:
- GitHub OIDC provider in IAM.
- IAM role trust policy for your repository.
- IAM permissions for ECR push, EKS describe, and Secrets Manager read.

Important:
- You must also grant this IAM role Kubernetes access in EKS.
- For bootstrap, map it to cluster-admin, then reduce to least privilege RBAC later.

## 4) Configure GitHub Repository Secrets

In GitHub repo settings for Actions secrets, add:

- AWS_ROLE_TO_ASSUME
- AWS_REGION
- EKS_CLUSTER_NAME
- OPENAI_SECRET_ID

Example OPENAI_SECRET_ID value:
recruiterreply/dev/openai-api-key

## 5) Apply DEV Manifests Locally Once

The workflow can apply these each run, but do an initial apply to validate:

aws eks update-kubeconfig --name recruiterreply-dev --region us-east-1
kubectl apply -k infra/k8s/dev

Create real backend secret before app traffic:

kubectl -n recruiterreply-dev create secret generic recruiterreply-backend-secrets \
	--from-literal=OpenAI__ApiKey=YOUR_REAL_OPENAI_KEY \
	--dry-run=client -o yaml | kubectl apply -f -

## 6) Trigger Webhook Deployment

The workflow triggers on push to dev.

git checkout -b dev
git push -u origin dev

For future deploys:

git add .
git commit -m "Deploy change"
git push origin dev

## 7) Verify Deployment

- Check GitHub Actions run success.
- Check workloads:
	kubectl -n recruiterreply-dev get deploy,svc,ingress,pods
- Check rollout:
	kubectl -n recruiterreply-dev rollout status deployment/recruiterreply-frontend
	kubectl -n recruiterreply-dev rollout status deployment/recruiterreply-backend

## 8) Troubleshooting

- If AWS auth fails in workflow: validate AWS_ROLE_TO_ASSUME trust policy and repo name.
- If kubectl apply fails from CI: map the IAM role to EKS access entry and RBAC.
- If image pull fails: confirm ECR repo names and pushed image tags.
- If frontend loads but API fails: verify ingress and backend service path /api.
