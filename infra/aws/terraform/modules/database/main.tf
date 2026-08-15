resource "random_password" "db" {
  count   = var.db_password == null ? 1 : 0
  length  = 24
  special = true
}

locals {
  master_password = var.db_password != null ? var.db_password : random_password.db[0].result
}

resource "aws_db_subnet_group" "this" {
  name       = "${var.name_prefix}-db-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name = "${var.name_prefix}-db-subnet-group"
  }
}

resource "aws_db_instance" "this" {
  identifier                   = "${var.name_prefix}-postgres"
  engine                       = "postgres"
  engine_version               = var.engine_version
  instance_class               = var.db_instance_class
  allocated_storage            = var.allocated_storage
  max_allocated_storage        = var.max_allocated_storage
  db_name                      = var.db_name
  username                     = var.db_username
  password                     = local.master_password
  db_subnet_group_name         = aws_db_subnet_group.this.name
  vpc_security_group_ids       = [var.rds_security_group_id]
  backup_retention_period      = var.backup_retention_period
  multi_az                     = var.multi_az
  publicly_accessible          = var.publicly_accessible
  deletion_protection          = var.deletion_protection
  skip_final_snapshot          = var.skip_final_snapshot
  auto_minor_version_upgrade   = true
  copy_tags_to_snapshot        = true
  storage_encrypted            = true
  performance_insights_enabled = false

  tags = {
    Name = "${var.name_prefix}-postgres"
  }
}
