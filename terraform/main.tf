# Consulta recursos existentes sin modificarlos.
data "aws_vpc" "existing" {
  id = var.vpc_id
}

data "aws_subnet" "existing" {
  id = var.subnet_id
}

data "aws_security_group" "existing" {
  id = var.security_group_id
}

data "aws_ebs_volume" "existing" {
  filter {
    name   = "volume-id"
    values = [var.ebs_volume_id]
  }
}

data "aws_iam_role" "existing" {
  name = var.iam_role_name
}

# VPC predeterminada existente en AWS.
resource "aws_vpc" "main" {
  cidr_block           = "172.31.0.0/16"
  instance_tenancy     = "default"
  enable_dns_support   = true
  enable_dns_hostnames = true
}

# Subnet existente donde se ejecuta la instancia de producción.
resource "aws_subnet" "production" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "172.31.32.0/20"
  availability_zone       = "us-east-2c"
  map_public_ip_on_launch = true
}

# Security Group existente de producción.
resource "aws_security_group" "production" {
  name        = "launch-wizard-3"
  description = "launch-wizard-3 created 2026-10-25T14:18:02.049Z"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = ""
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = ""
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [
      "201.216.171.33/32",
      "190.104.120.119/32"
    ]
  }

  ingress {
    description = ""
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  lifecycle {
    prevent_destroy = true
  }
}
