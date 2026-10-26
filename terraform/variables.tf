variable "instance_id" {
  description = "ID de la instancia EC2 existente."
  type        = string
}

variable "vpc_id" {
  description = "ID de la VPC existente."
  type        = string
}

variable "subnet_id" {
  description = "ID de la subnet existente donde está la instancia."
  type        = string
}

variable "security_group_id" {
  description = "ID del security group existente asociado a la instancia."
  type        = string
}

variable "ebs_volume_id" {
  description = "ID del volumen EBS existente."
  type        = string
}

variable "iam_role_name" {
  description = "Nombre del rol IAM existente asociado al despliegue."
  type        = string
}
