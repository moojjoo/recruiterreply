# AWS Deployment Guide (Dev/Test/Prod on One EC2)

This setup matches the target architecture exactly:

1. Domain: recruiterreply.com
2. Frontend:
   1. dev.recruiterreply.com
   2. test.recruiterreply.com
   3. recruiterreply.com
3. API:
   1. api-dev.recruiterreply.com
   2. api-test.recruiterreply.com
   3. api.recruiterreply.com
4. Infrastructure:
   1. One EC2 instance (initially)
   2. One PostgreSQL container
   3. Three backend containers (dev/test/prod)
   4. Three S3 buckets
   5. Three CloudFront distributions

This is the lowest-cost AWS-first launch architecture with clean environment separation.

## 1) What Changed in This Repository

The following files now implement this architecture:

1. .github/workflows/deploy-dev.yml
2. .github/workflows/deploy-test.yml
3. .github/workflows/deploy-prod.yml
4. infra/aws/docker-compose.multi-env.yml
5. infra/aws/.env.multi-env.example
6. infra/aws/nginx-api-multi-env.conf
7. infra/aws/postgres-init/01-create-databases.sql

## 2) High-Level Flow

For each environment (dev/test/prod):

1. GitHub Actions builds backend image and pushes to ECR
2. GitHub Actions builds frontend and uploads to that environment's S3 bucket
3. GitHub Actions invalidates that environment's CloudFront distribution
4. GitHub Actions SSHes into EC2 and updates exactly one backend service image
5. Nginx routes each API hostname to the correct local backend port

## 3) AWS Resources to Create

### 3.1 Networking and DNS

1. Hosted zone: recruiterreply.com in Route 53
2. Records:
   1. dev.recruiterreply.com -> CloudFront DEV
   2. test.recruiterreply.com -> CloudFront TEST
   3. recruiterreply.com -> CloudFront PROD
   4. api-dev.recruiterreply.com -> EC2 public IP or EIP
   5. api-test.recruiterreply.com -> EC2 public IP or EIP
   6. api.recruiterreply.com -> EC2 public IP or EIP

### 3.2 EC2

Recommended start:

1. Instance: t3.small (simplest image compatibility)
2. OS: Ubuntu 24.04 LTS
3. Volume: 30-60 GB gp3
4. Security group inbound:
   1. 22 from your IP only
   2. 80 from 0.0.0.0/0
   3. 443 from 0.0.0.0/0
   4. No public 5432

Install packages:

```bash
sudo apt update && sudo apt -y upgrade
sudo apt -y install docker.io docker-compose-v2 nginx certbot python3-certbot-nginx awscli
sudo systemctl enable docker
sudo usermod -aG docker ubuntu
```

Log out and log back in once.

### 3.3 ECR

```bash
AWS_REGION=us-east-1
aws ecr create-repository --repository-name recruiterreply-backend --region "$AWS_REGION" || true
```

### 3.4 Frontend Buckets and CloudFront

Create three S3 buckets:

1. recruiterreply-dev-frontend-<unique>
2. recruiterreply-test-frontend-<unique>
3. recruiterreply-prod-frontend-<unique>

For each bucket:

1. Keep bucket private
2. Attach CloudFront with Origin Access Control (OAC)
3. SPA behavior:
   1. default root object: index.html
   2. 403 -> /index.html (200)
   3. 404 -> /index.html (200)

### 3.5 Enable Origin Access Control (OAC)

Do this for dev, test, and prod frontend distributions.

1. CloudFront -> Security -> Origin access -> Create control setting
2. Select origin type S3 and signing behavior Sign requests (recommended)
3. Open your CloudFront distribution -> Origins -> select the S3 origin -> Edit
4. Set Origin access to Origin access control settings and choose the OAC you created
5. Save distribution changes
6. Keep S3 Block Public Access enabled for the bucket
7. Add bucket policy allowing only that CloudFront distribution ARN as SourceArn

Use this bucket policy shape (replace account id, distribution id, and bucket name):

{
   "Version": "2012-10-17",
   "Statement": [
      {
         "Sid": "AllowCloudFrontServicePrincipalReadOnly",
         "Effect": "Allow",
         "Principal": {
            "Service": "cloudfront.amazonaws.com"
         },
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::your-bucket-name/*",
         "Condition": {
            "StringEquals": {
               "AWS:SourceArn": "arn:aws:cloudfront::123456789012:distribution/EDFDVBD6EXAMPLE"
            }
         }
      }
   ]
}

Validation checklist:

1. S3 object URL returns AccessDenied (expected)
2. CloudFront URL for same object returns 200
3. Website domain (dev.recruiterreply.com, test.recruiterreply.com, recruiterreply.com) loads correctly

## 4) EC2 Runtime Layout

On EC2:

```bash
mkdir -p /home/ubuntu/recruiterreply
cd /home/ubuntu/recruiterreply
```

Copy these files from repo into the same paths on EC2:

1. infra/aws/docker-compose.multi-env.yml
2. infra/aws/nginx-api-multi-env.conf
3. infra/aws/postgres-init/01-create-databases.sql

Create .env from template:

```bash
cp infra/aws/.env.multi-env.example .env
chmod 600 .env
```

Edit .env values:

1. POSTGRES_SUPERPASS
2. OPENAI_API_KEY
3. JWT_KEY_DEV
4. JWT_KEY_TEST
5. JWT_KEY_PROD
6. BACKEND_IMAGE_DEV
7. BACKEND_IMAGE_TEST
8. BACKEND_IMAGE_PROD

## 5) Start Containers on EC2

```bash
cd /home/ubuntu/recruiterreply
docker compose -f infra/aws/docker-compose.multi-env.yml up -d postgres
docker compose -f infra/aws/docker-compose.multi-env.yml up -d backend-dev backend-test backend-prod
```

Expected internal ports:

1. backend-dev -> 127.0.0.1:5001
2. backend-test -> 127.0.0.1:5002
3. backend-prod -> 127.0.0.1:5003

## 6) Configure Nginx for 3 API Hostnames

```bash
sudo cp /home/ubuntu/recruiterreply/infra/aws/nginx-api-multi-env.conf /etc/nginx/sites-available/recruiterreply-api
sudo ln -sf /etc/nginx/sites-available/recruiterreply-api /etc/nginx/sites-enabled/recruiterreply-api
sudo nginx -t
sudo systemctl reload nginx
```

Issue certificates:

```bash
sudo certbot --nginx -d api-dev.recruiterreply.com -d api-test.recruiterreply.com -d api.recruiterreply.com
```

## 7) GitHub Environments and Variables

Create GitHub environments:

1. dev
2. test
3. prod

For each environment, set variables:

1. AWS_REGION
2. AWS_ROLE_TO_ASSUME (or access key variables)
3. ECR_REPO_BACKEND (default recruiterreply-backend)
4. S3_FRONTEND_BUCKET (environment-specific)
5. CLOUDFRONT_DISTRIBUTION_ID (environment-specific)
6. EC2_HOST
7. EC2_USER (usually ubuntu)
8. EC2_DEPLOY_PATH (usually /home/ubuntu/recruiterreply)
9. BACKEND_DOCKER_PLATFORM (linux/amd64 unless you do multi-arch)

Secrets required per environment:

1. EC2_SSH_PRIVATE_KEY

Note: API/OpenAI/JWT/DB runtime secrets are read on EC2 from /home/ubuntu/recruiterreply/.env.

## 8) Branch to Environment Mapping

Current workflow triggers:

1. dev branch -> deploy-dev.yml -> dev environment
2. test branch -> deploy-test.yml -> test environment
3. main branch -> deploy-prod.yml -> prod environment

## 9) First Deployment Checklist

1. Create AWS resources (EC2, ECR, 3x S3, 3x CloudFront, DNS)
2. Configure EC2 runtime files and .env
3. Start postgres + 3 backend containers once
4. Configure Nginx and TLS certs
5. Configure GitHub environments/variables/secrets
6. Push to dev branch and verify:
   1. https://dev.recruiterreply.com
   2. https://api-dev.recruiterreply.com
7. Repeat for test and prod

## 10) Backups and Safety

You are running one PostgreSQL container for all environments. Do these immediately:

1. Nightly pg_dump backup to S3
2. 14-30 day retention policy
3. Monthly restore test into temporary DB

Minimal backup example:

```bash
#!/usr/bin/env bash
set -euo pipefail

TS=$(date +%Y%m%d-%H%M%S)
OUT="/tmp/recruiterreply_${TS}.sql.gz"

docker exec recruiterreply-postgres pg_dumpall -U postgres | gzip > "$OUT"
aws s3 cp "$OUT" "s3://your-backup-bucket/postgres/"
rm -f "$OUT"
```

## 11) Cost and Upgrade Path

This is cost-optimized for launch. As traffic grows:

1. Move prod backend to separate EC2 first
2. Move Postgres to RDS next
3. Keep frontend on S3 + CloudFront

That progression keeps cost controlled while reducing operational risk.
