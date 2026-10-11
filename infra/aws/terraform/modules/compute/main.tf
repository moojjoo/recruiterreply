data "aws_iam_policy_document" "ec2_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ec2" {
  name               = "${var.name_prefix}-ec2-role"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume_role.json
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy" "postgres_backup" {
  name = "${var.name_prefix}-postgres-backup"
  role = aws_iam_role.ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ListEnvironmentBackups"
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = var.backup_bucket_arn
        Condition = {
          StringLike = {
            "s3:prefix" = ["${var.backup_environment}/*"]
          }
        }
      },
      {
        Sid    = "ReadWriteEnvironmentBackups"
        Effect = "Allow"
        Action = [
          "s3:AbortMultipartUpload",
          "s3:GetObject",
          "s3:PutObject",
        ]
        Resource = "${var.backup_bucket_arn}/${var.backup_environment}/*"
      },
    ]
  })
}

resource "aws_iam_instance_profile" "ec2" {
  name = "${var.name_prefix}-ec2-profile"
  role = aws_iam_role.ec2.name
}

resource "aws_instance" "this" {
  ami                         = var.ami_id
  instance_type               = var.instance_type
  subnet_id                   = var.subnet_id
  key_name                    = var.key_name
  vpc_security_group_ids      = [var.ec2_security_group_id]
  iam_instance_profile        = aws_iam_instance_profile.ec2.name
  associate_public_ip_address = var.enable_public_ip
  user_data                   = var.user_data

  root_block_device {
    volume_size           = var.root_volume_size
    volume_type           = "gp3"
    encrypted             = true
    delete_on_termination = true
  }

  tags = {
    Name = "${var.name_prefix}-app-host"
  }
}

resource "aws_eip" "this" {
  count  = var.enable_elastic_ip ? 1 : 0
  domain = "vpc"

  tags = {
    Name = "${var.name_prefix}-api-eip"
  }
}

resource "aws_eip_association" "this" {
  count         = var.enable_elastic_ip ? 1 : 0
  allocation_id = aws_eip.this[0].id
  instance_id   = aws_instance.this.id
}
