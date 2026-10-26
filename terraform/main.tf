# Solo consulta recursos existentes. Estos data sources no crean ni modifican
# recursos de AWS; permiten revisar los valores antes de planificar imports.
data "aws_instance" "existing" {
  instance_id = var.instance_id
}

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
