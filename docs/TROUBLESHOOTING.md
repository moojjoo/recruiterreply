# Troubleshooting Guide - RecruiterReply Deployment

This guide helps resolve common issues during deployment.

## Infrastructure Issues

### Terraform State Lock

**Problem:** `Error acquiring the state lock`

**Solution:**
```bash
# List lock entries
aws dynamodb scan \
  --table-name recruiterreply-terraform-locks \
  --region us-east-1

# Force unlock (only if workflow is stuck)
aws dynamodb delete-item \
  --table-name recruiterreply-terraform-locks \
  --key '{"LockID": {"S": "recruiterreply/dev/terraform.tfstate"}}' \
  --region us-east-1
```

### S3 Backend Access Denied

**Problem:** `Error reading S3 Bucket Version: AccessDenied`

**Solution:**
```bash
# Verify S3 bucket exists
aws s3 ls | grep recruiterreply-terraform-state

# Check IAM role policy
aws iam get-role-policy \
  --role-name GitHubActionsRecruiterReplyDeployer \
  --policy-name TerraformManagementPolicy

# Verify bucket region
aws s3api head-bucket \
  --bucket recruiterreply-terraform-state-ACCOUNT_ID \
  --region us-east-1
```

### VPC/Subnet Issues

**Problem:** `Error creating subnet: InvalidParameterValue`

**Solution:**
```bash
# Verify VPC exists
aws ec2 describe-vpcs --filters "Name=tag:Name,Values=recruiterreply-dev-vpc"

# Check available IP ranges
aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=vpc-xxxxx" \
  --query 'Subnets[*].[CidrBlock,AvailabilityZone]'

# Verify availability zones
aws ec2 describe-availability-zones \
  --query 'AvailabilityZones[*].[ZoneName]'
```

### EC2 Launch Fails

**Problem:** `InsufficientInstanceCapacity` or `InstanceLimitExceeded`

**Solution:**
```bash
# Try different instance type
# Edit infra/aws/terraform/environments/dev.tfvars
instance_type = "t3.medium"  # Instead of t3.small

# Or use different availability zone
availability_zones = ["us-east-1b", "us-east-1c"]

# Re-apply
terraform apply -var-file="environments/dev.tfvars"
```

---

## GitHub Actions Issues

### Workflow Not Triggering

**Problem:** Push to `dev` branch but workflow doesn't run

**Solution:**
```bash
# 1. Check branch protection rules
# Settings → Branches → Branch protection rules
# Ensure workflow can push to protected branches

# 2. Verify workflow file syntax
github-cli run gh workflow list --repo moojjoo/recruiterreply

# 3. Check workflow trigger paths
# In .github/workflows/deploy-dev.yml:
on:
  push:
    branches: ["dev"]  # Ensure your branch matches exactly

# 4. Manual trigger
# Go to Actions → select workflow → "Run workflow"
```

### AWS Credentials Error

**Problem:** `An error occurred (InvalidClientTokenId) when calling the GetCallerIdentity operation`

**Solution:**
```bash
# 1. Verify OIDC provider exists
aws iam list-open-id-connect-providers

# 2. If missing, create OIDC provider
# First, get thumbprint
THUMBPRINT=$(curl -s https://token.actions.githubusercontent.com/.well-known/openid-configuration \
  | jq -r '.issuer' | xargs curl -s | openssl x509 -fingerprint -noout | cut -d'=' -f2 | tr -d ':')

aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list "$THUMBPRINT"

# 3. Verify IAM role trust policy
aws iam get-role \
  --role-name GitHubActionsRecruiterReplyDeployer \
  --query 'Role.AssumeRolePolicyDocument' | jq .

# 4. Verify repo matches trust policy
# Should include: "repo:moojjoo/recruiterreply:*"
```

### Build Steps Timing Out

**Problem:** `Error: Process completed with exit code 124`

**Solution:**
```yaml
# Increase timeout in workflow file
jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 60  # Default is 360, but set explicitly

    steps:
      - name: Long-running step
        timeout-minutes: 30  # For specific steps
        run: |
          # command
```

### Docker Build Out of Memory

**Problem:** `fatal error: signal: killed`

**Solution:**
```bash
# 1. Use ubuntu-latest runner with more resources
runs-on: ubuntu-latest  # Has 7 GB RAM

# 2. Or use self-hosted runner with more resources
# Settings → Actions → Runners → Add self-hosted runner

# 3. Optimize Dockerfile
# Multi-stage builds reduce final image size
FROM mcr.microsoft.com/dotnet/sdk:10 AS builder
# ... build steps
FROM mcr.microsoft.com/dotnet/aspnet:10
COPY --from=builder /app/bin/Release /app
```

### S3 Upload Fails

**Problem:** `An error occurred (NoSuchBucket) when calling the PutObject operation`

**Solution:**
```bash
# 1. Verify bucket exists
aws s3 ls | grep recruiterreply

# 2. Check IAM permissions
aws iam get-role-policy \
  --role-name GitHubActionsRecruiterReplyDeployer \
  --policy-name RecruiterReplyDeploymentPolicy

# 3. Ensure bucket name in variables matches
# Settings → Variables → S3_FRONTEND_BUCKET

# 4. Verify bucket is not locked
aws s3api get-bucket-versioning --bucket recruiterreply-dev-frontend-xxxxx

# 5. Test upload locally
aws s3 cp README.md s3://recruiterreply-dev-frontend-xxxxx/test.txt
```

---

## Application Issues

### Backend Container Won't Start

**Problem:** `docker: Error response from daemon: OCI runtime create failed`

**SSH to EC2 first:**
```bash
ssh -i your-key.pem ubuntu@EC2_PUBLIC_IP

# Check container logs
docker logs backend-dev --tail 100

# Inspect running containers
docker ps -a

# Check Docker daemon
docker info

# Restart Docker
sudo systemctl restart docker

# Check system resources
free -h
df -h
```

### Database Connection Error

**Problem:** `Npgsql.NpgsqlException: unable to connect to the database`

**Solution:**
```bash
# 1. Check RDS endpoint
aws rds describe-db-instances \
  --db-instance-identifier recruiterreply-dev

# 2. Get endpoint
ENDPOINT=$(aws rds describe-db-instances \
  --query 'DBInstances[0].Endpoint.Address' --output text)

# 3. Test connection from EC2
ssh -i your-key.pem ubuntu@EC2_PUBLIC_IP

psql -h $ENDPOINT -U admin -d recruiterreply_dev

# 4. Check security group rules
aws ec2 describe-security-groups \
  --filters "Name=tag:Name,Values=*rds*"

# 5. If using Docker on EC2, connect to RDS
docker run --rm -it postgres:15 \
  psql -h $ENDPOINT -U admin -d recruiterreply_dev
```

### OpenAI API Errors

**Problem:** `OpenAI API request failed: InvalidRequestError`

**Solution:**
```bash
# 1. Check API key in Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id recruiterreply/dev \
  --query 'SecretString' | jq .

# 2. Verify key format (should start with sk-proj-)
aws secretsmanager get-secret-value \
  --secret-id recruiterreply/dev \
  --query 'SecretString' | jq '.OPENAI_API_KEY' | head -c 20

# 3. Test API key locally
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer sk-proj-YOUR_KEY" \
  | jq .

# 4. Check API key quotas
# Go to https://platform.openai.com/account/api-keys

# 5. Verify model name
# Currently uses GPT-4-Turbo
# Check if available in your region/account
```

### Frontend Blank Page

**Problem:** `ERR_CONTENT_SECURITY_POLICY`

**Solution:**
```bash
# 1. Check browser console for errors
# Right-click → Inspect → Console tab

# 2. Verify API_BASE_URL is correct
VITE_API_BASE_URL="https://api-dev.recruiterreply.com"

# 3. Test API endpoint
curl -X GET https://api-dev.recruiterreply.com/swagger/

# 4. Check CORS headers
curl -I -X OPTIONS \
  -H "Origin: https://dev.recruiterreply.com" \
  https://api-dev.recruiterreply.com/api/analyze

# 5. Verify CloudFront distribution
aws cloudfront get-distribution \
  --id E1234567890ABC \
  --query 'Distribution.DistributionConfig.Origins'
```

---

## DNS Issues

### Domain Not Resolving

**Problem:** `nslookup: can't find recruiterreply.com`

**Solution:**
```bash
# 1. Verify Route 53 hosted zone
aws route53 list-hosted-zones-by-name --query 'HostedZones[*].[Name,Id]'

# 2. List DNS records
aws route53 list-resource-record-sets \
  --hosted-zone-id Z1234567890ABC

# 3. Test DNS resolution
nslookup recruiterreply.com
dig recruiterreply.com

# 4. Verify nameserver delegation
# Check domain registrar nameservers point to Route 53 nameservers

# 5. Wait for DNS propagation
# Can take 24-48 hours for global propagation
# Check status: https://www.whatsmydns.net/
```

### HTTPS Certificate Issues

**Problem:** `NET::ERR_CERT_AUTHORITY_INVALID`

**Solution:**
```bash
# 1. Check certificate in ACM
aws acm list-certificates

# 2. Describe certificate
aws acm describe-certificate \
  --certificate-arn arn:aws:acm:us-east-1:ACCOUNT_ID:certificate/CERT_ID

# 3. Request new certificate if expired
aws acm request-certificate \
  --domain-name recruiterreply.com \
  --subject-alternative-names api.recruiterreply.com \
  --validation-method DNS

# 4. Validate certificate (DNS method)
# Copy CNAME record to Route 53

# 5. Update ALB/CloudFront to use new certificate
aws elbv2 modify-listener \
  --listener-arn arn:aws:elasticloadbalancing:us-east-1:ACCOUNT_ID:listener/app/rr/xxxx \
  --protocol HTTPS \
  --certificates CertificateArn=arn:aws:acm:us-east-1:ACCOUNT_ID:certificate/NEW_CERT_ID
```

---

## Performance Issues

### Slow Application Response

**Problem:** API endpoint takes >5 seconds to respond

**Solution:**
```bash
# 1. Check EC2 resource usage
ssh -i your-key.pem ubuntu@EC2_PUBLIC_IP
top
free -h
df -h
netstat -an | grep ESTABLISHED | wc -l

# 2. Check Docker resource limits
docker stats

# 3. Increase container resources
# Edit docker-compose.yml:
services:
  backend-dev:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 2G

# 4. Scale horizontally (add more containers)
docker-compose -f docker-compose.multi-env.yml up -d

# 5. Enable caching
# Update backend services to implement caching
```

### High Data Transfer Costs

**Problem:** AWS bill shows high CloudFront/S3 costs

**Solution:**
```bash
# 1. Enable CloudFront caching
# Update cache behavior settings

# 2. Compress assets
# Enable Gzip in CloudFront

# 3. Delete old S3 versions
aws s3api delete-object-versions \
  --bucket recruiterreply-dev-frontend-xxxxx

# 4. Set S3 lifecycle policies
# Auto-delete old versions after 30 days
```

---

## Debugging Commands

```bash
# 1. Get comprehensive diagnostics
aws configure list
aws sts get-caller-identity
aws ec2 describe-regions

# 2. Check recent errors
aws logs describe-log-streams --log-group-name /aws/ec2/recruiterreply
aws logs tail /aws/ec2/recruiterreply --follow

# 3. Monitor deployment
watch -n 5 'aws ec2 describe-instances --filters "Name=tag:Environment,Values=dev"'

# 4. Get workflow run details
gh run list --repo moojjoo/recruiterreply
gh run view RUN_ID --repo moojjoo/recruiterreply

# 5. Export infrastructure state
cd infra/aws/terraform
terraform show
terraform show -json > state.json
```

---

## Emergency Procedures

### Rollback Deployment

```bash
# 1. Get previous terraform state
aws s3api list-object-versions \
  --bucket recruiterreply-terraform-state-xxxxx \
  --prefix dev/terraform.tfstate

# 2. Restore previous state
aws s3api get-object \
  --bucket recruiterreply-terraform-state-xxxxx \
  --key dev/terraform.tfstate \
  --version-id VERSION_ID \
  terraform.tfstate

# 3. Re-apply previous state
terraform apply terraform.tfstate
```

### Disable Auto-Deployments

```bash
# Disable workflow temporarily
gh workflow disable infrastructure.yml --repo moojjoo/recruiterreply

# Re-enable when ready
gh workflow enable infrastructure.yml --repo moojjoo/recruiterreply
```

### Manual Deployment

```bash
# SSH to EC2 and deploy manually
ssh -i your-key.pem ubuntu@EC2_PUBLIC_IP

# Pull latest code
cd /home/ubuntu/recruiterreply
git pull origin dev

# Rebuild backend
docker build -t backend-dev:manual ./backend
docker stop backend-dev
docker rm backend-dev
docker-compose -f docker-compose.yml up -d

# Rebuild frontend
cd frontend && npm install && npm run build
aws s3 sync dist/ s3://recruiterreply-dev-frontend-xxxxx/
```

---

## Getting Help

1. **Check GitHub Issues:** https://github.com/moojjoo/recruiterreply/issues
2. **Review Workflow Logs:** GitHub Actions tab
3. **AWS Support:** https://console.aws.amazon.com/support/
4. **OpenAI Help:** https://help.openai.com/

---

**Last Updated:** 2026-08-14  
**Version:** 1.0
