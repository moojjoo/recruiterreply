module "network" {
  source = "../../modules/network"

  name_prefix          = local.name_prefix
  vpc_cidr             = var.vpc_cidr
  availability_zones   = var.availability_zones
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
}

module "security" {
  source = "../../modules/security"

  name_prefix          = local.name_prefix
  vpc_id               = module.network.vpc_id
  allowed_ssh_cidrs    = var.allowed_ssh_cidrs
  public_ingress_cidrs = var.public_ingress_cidrs
}

module "compute" {
  source = "../../modules/compute"

  name_prefix           = local.name_prefix
  subnet_id             = module.network.public_subnet_ids[0]
  ec2_security_group_id = module.security.ec2_security_group_id
  instance_type         = var.instance_type
  ami_id                = var.ami_id
  key_name              = var.key_name
  root_volume_size      = var.ec2_root_volume_size
  user_data             = local.ec2_user_data
  enable_public_ip      = true
}

module "secrets" {
  source = "../../modules/secrets"

  name_prefix   = local.name_prefix
  ec2_role_name = module.compute.role_name
}

module "database" {
  count  = var.enable_rds ? 1 : 0
  source = "../../modules/database"

  name_prefix             = local.name_prefix
  private_subnet_ids      = module.network.private_subnet_ids
  rds_security_group_id   = module.security.rds_security_group_id
  db_name                 = var.db_name
  db_username             = var.db_username
  db_password             = var.db_password
  db_instance_class       = var.db_instance_class
  allocated_storage       = var.db_allocated_storage
  max_allocated_storage   = var.db_max_allocated_storage
  backup_retention_period = var.db_backup_retention_period
  multi_az                = var.db_multi_az
  publicly_accessible     = false
  deletion_protection     = var.db_deletion_protection
  skip_final_snapshot     = var.db_skip_final_snapshot
  engine_version          = var.db_engine_version
}
