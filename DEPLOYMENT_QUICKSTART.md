# RecruiterReply AWS Deployment - Quick Start

Complete guide to deploy RecruiterReply to AWS with automated CI/CD pipeline.

## 🚀 Quick Start (5 minutes)

### 1. Setup AWS Account
```bash
# Run automated setup script
cd scripts
bash setup-aws-deployment.sh

# This creates:
# ✓ S3 bucket for Terraform state
# ✓ DynamoDB table for state locking  
# ✓ OIDC provider for GitHub Actions (no API keys!)
# ✓ IAM role with minimum required permissions
# ✓ Policies for S3, CloudFront, EC2, RDS, etc.
```

### 2. Configure GitHub Secrets
Copy output from setup script and add to:
**Settings → Secrets and variables → Actions**

```
Required Secrets:
├── AWS_ROLE_TO_ASSUME        (from setup output)
├── TF_STATE_BUCKET           (from setup output)
├── TF_LOCK_TABLE             (from setup output)
└── AWS_REGION                (us-east-1)
```

### 3. Update Terraform Configuration
Edit `infra/aws/terraform/environments/dev.tfvars`:

```hcl
aws_region          = "us-east-1"
app_name            = "recruiterreply"
environment         = "development"
availability_zones  = ["us-east-1a", "us-east-1b"]
public_subnet_cidrs = ["10.30.1.0/24", "10.30.2.0/24"]
private_subnet_cidrs = ["10.30.10.0/24", "10.30.20.0/24"]

# EC2 instance for backend
instance_type = "t3.small"
key_name      = "your-keypair-name"  # Must exist in AWS
allowed_ssh_cidrs = ["YOUR_PUBLIC_IP/32"]

# Frontend S3 buckets
create_frontend_buckets = true
frontend_bucket_names = {
  dev = "recruiterreply-dev-frontend-YOUR_ACCOUNT_ID"
}
```

### 4. Deploy Infrastructure
```bash
git add infra/aws/terraform/
git commit -m "chore: configure terraform for deployment"
git push origin dev

# Watch GitHub Actions:
# Actions → Deploy Infrastructure (Terraform) → Follow logs
```

### 5. Get Infrastructure Outputs
After Terraform apply succeeds:
```bash
cd infra/aws/terraform
terraform output

# Note these values:
# - vpc_id
# - ec2_public_ip
# - public_subnet_ids
# - private_subnet_ids
```

### 6. Setup Route 53 DNS
```bash
# Create hosted zone for recruiterreply.com
aws route53 create-hosted-zone \
  --name recruiterreply.com \
  --caller-reference $(date +%s)

# Create A record pointing to EC2
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890ABC \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "api-dev.recruiterreply.com",
        "Type": "A",
        "TTL": 300,
        "ResourceRecords": [{"Value": "EC2_PUBLIC_IP"}]
      }
    }]
  }'
```

### 7. Add GitHub Workflow Secrets
Go to **Settings → Secrets and variables → Variables** and add:

```
ENVIRONMENT:    development
S3_FRONTEND_BUCKET: recruiterreply-dev-frontend-ACCOUNT_ID
EC2_INSTANCE_ID:    i-xxxxxxxx (from Terraform output)
EC2_DEPLOY_PATH:    /home/ubuntu/recruiterreply
CLOUDFRONT_DISTRIBUTION_ID: (optional, leave empty initially)
```

### 8. Deploy Application
```bash
git push origin dev  # Triggers deploy-dev.yml workflow
# Application deploys automatically via GitHub Actions
```

---

## 📦 What Gets Deployed

### Infrastructure (Terraform)
- **VPC**: 10.30.0.0/16 with 2 public + 2 private subnets (Multi-AZ)
- **EC2**: t3.small instance for backend applications
- **Security Groups**: Restricted SSH, open HTTP/HTTPS
- **S3 Buckets**: Frontend static site hosting
- **CloudFront**: CDN distribution (optional)
- **RDS**: PostgreSQL (optional, can be disabled)
- **NAT Gateways**: For private subnet outbound access

### Application
- **Backend**: .NET Core 10 API running on EC2
- **Frontend**: React SPA served from S3 via CloudFront
- **Database**: PostgreSQL for persistence
- **Authentication**: OAuth 2.0 + JWT tokens

---

## 🔄 CI/CD Pipeline

### Workflows
1. **infrastructure.yml** - Terraform plan/apply
2. **deploy-dev.yml** - Deploy to dev environment
3. **deploy-prod.yml** - Deploy to production (main branch)

### Deployment Flow
```
Git Push (dev branch)
    ↓
GitHub Actions Trigger
    ├─ Build Backend (Docker)
    ├─ Push to ECR
    ├─ Build Frontend (React)
    ├─ Upload to S3
    ├─ Invalidate CloudFront
    └─ Deploy Container to EC2
    ↓
Application Live at:
    • Frontend: https://dev.recruiterreply.com
    • API: https://api-dev.recruiterreply.com
```

---

## 💰 Cost Estimate

### Monthly Costs (Dev Environment)
| Service | Size | Cost |
|---------|------|------|
| EC2 | t3.small (~730 hrs) | ~$10 |
| S3 | Frontend storage (~100MB) | <$1 |
| NAT Gateway | 1 gateway | ~$32 |
| Data transfer | ~10GB | ~$1 |
| **Total** | **Dev** | **~$45** |

### Production Costs
| Service | Size | Cost |
|---------|------|------|
| EC2 | t3.medium (~730 hrs) | ~$30 |
| RDS | db.t3.small | ~$20 |
| NAT Gateway | 2 gateways (Multi-AZ) | ~$64 |
| CloudFront | ~100GB | ~$10 |
| **Total** | **Prod** | **~$125** |

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) | Complete step-by-step setup |
| [GITHUB_ACTIONS_SETUP.md](docs/GITHUB_ACTIONS_SETUP.md) | Configuration checklist |
| [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Common issues & solutions |
| [AWS_DEV_DEPLOY.md](docs/AWS_DEV_DEPLOY.md) | Multi-environment architecture |

---

## ⚡ Common Commands

### View Infrastructure
```bash
# Show all resources
cd infra/aws/terraform
terraform show

# Export outputs to JSON
terraform output -json > outputs.json

# Specific output
terraform output ec2_public_ip
```

### SSH to EC2
```bash
ssh -i your-keypair.pem ubuntu@EC2_PUBLIC_IP

# Check application status
docker ps
docker logs backend-dev

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
```

### Monitor Deployment
```bash
# Watch infrastructure changes
watch -n 5 'cd infra/aws/terraform && terraform show | grep -E "resource|id"'

# Check GitHub Actions
gh run list --repo moojjoo/recruiterreply
gh run view RUN_ID --repo moojjoo/recruiterreply
```

### Scale Application
```bash
# Update instance type
# Edit: infra/aws/terraform/environments/dev.tfvars
instance_type = "t3.medium"

# Apply changes
terraform apply -var-file="environments/dev.tfvars"
```

---

## 🔐 Security Best Practices

- ✅ Use OIDC for GitHub Actions (no API keys stored)
- ✅ Store secrets in AWS Secrets Manager
- ✅ Restrict SSH to your IP only
- ✅ Enable S3 versioning for backups
- ✅ Use security groups for network isolation
- ✅ Enable CloudTrail for audit logging
- ✅ Rotate API keys monthly
- ✅ Never commit real secrets to Git

---

## 🆘 Need Help?

1. **Check workflow logs**: GitHub Actions → select workflow → view logs
2. **Read troubleshooting guide**: [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
3. **SSH to EC2 and debug**: See Common Commands section
4. **View Terraform state**: `terraform show`
5. **Check AWS resources**: AWS Console → EC2, S3, Route 53, etc.

---

## 📋 Deployment Checklist

- [ ] AWS account setup complete (`setup-aws-deployment.sh` run)
- [ ] GitHub secrets configured (6 secrets)
- [ ] GitHub variables configured (5+ variables)
- [ ] Terraform files updated
- [ ] Route 53 DNS configured
- [ ] First Terraform apply succeeded
- [ ] EC2 running and accessible
- [ ] Application deployed
- [ ] Frontend accessible at custom domain
- [ ] API accessible at custom domain
- [ ] SSL certificates valid
- [ ] Monitoring configured
- [ ] Backups enabled

---

## 📞 Support Resources

- **AWS Docs**: https://docs.aws.amazon.com/
- **Terraform Docs**: https://www.terraform.io/docs
- **GitHub Actions**: https://docs.github.com/actions
- **RecruiterReply Architecture**: [docs/BACKEND_ARCHITECTURE.md](docs/BACKEND_ARCHITECTURE.md)

---

**Last Updated**: 2026-08-14  
**Version**: 1.0  
**Maintainers**: RecruiterReply Team  
**Status**: Production Ready
