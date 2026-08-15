aws_region  = "us-east-1"
app_name    = "recruiterreply"
environment = "test"

availability_zones   = ["us-east-1a", "us-east-1b"]
public_subnet_cidrs  = ["10.31.1.0/24", "10.31.2.0/24"]
private_subnet_cidrs = ["10.31.101.0/24", "10.31.102.0/24"]
vpc_cidr             = "10.31.0.0/16"

ami_id        = "ami-04b4f1a9cf54c11d0"
instance_type = "t3.small"

# SSH disabled; use AWS SSM Session Manager (EC2 role already has AmazonSSMManagedInstanceCore)
allowed_ssh_cidrs = []

enable_rds             = true
db_instance_class      = "db.t4g.micro"
db_skip_final_snapshot = true
db_deletion_protection = false
