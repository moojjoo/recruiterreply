aws_region  = "us-east-1"
app_name    = "recruiterreply"
environment = "production"

availability_zones   = ["us-east-1a", "us-east-1b"]
public_subnet_cidrs  = ["10.32.1.0/24", "10.32.2.0/24"]
private_subnet_cidrs = ["10.32.101.0/24", "10.32.102.0/24"]

ami_id        = "ami-04b4f1a9cf54c11d0"
instance_type = "t3.medium"

# SSH disabled; use AWS SSM Session Manager (EC2 role already has AmazonSSMManagedInstanceCore)
allowed_ssh_cidrs = []

enable_rds             = true
db_instance_class      = "db.t4g.small"
db_skip_final_snapshot = false
db_deletion_protection = true
db_multi_az            = true

create_frontend_buckets = true
frontend_bucket_names = {
  dev  = "recruiterreply-dev-frontend-178522450316"
  test = "recruiterreply-test-frontend-178522450316"
  prod = "recruiterreply-prod-frontend-178522450316"
}
