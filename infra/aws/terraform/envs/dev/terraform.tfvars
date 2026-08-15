aws_region  = "us-east-1"
app_name    = "recruiterreply"
environment = "development"

availability_zones   = ["us-east-1a", "us-east-1b"]
public_subnet_cidrs  = ["10.30.1.0/24", "10.30.2.0/24"]
private_subnet_cidrs = ["10.30.101.0/24", "10.30.102.0/24"]
vpc_cidr             = "10.30.0.0/16"

ami_id        = "ami-04b4f1a9cf54c11d0"
instance_type = "t3.small"

# SSH disabled; use AWS SSM Session Manager (EC2 role already has AmazonSSMManagedInstanceCore)
allowed_ssh_cidrs = []

enable_rds             = false
db_skip_final_snapshot = true
db_deletion_protection = false
