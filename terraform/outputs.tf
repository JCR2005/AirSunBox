output "instance_id" {
  description = "ID de la instancia EC2 consultada."
  value       = data.aws_instance.existing.id
}

output "vpc_id" {
  description = "ID de la VPC consultada."
  value       = data.aws_vpc.existing.id
}

output "subnet_id" {
  description = "ID de la subnet consultada."
  value       = data.aws_subnet.existing.id
}

output "security_group_id" {
  description = "ID del security group consultado."
  value       = data.aws_security_group.existing.id
}

output "ebs_volume_id" {
  description = "ID del volumen EBS consultado."
  value       = data.aws_ebs_volume.existing.id
}

output "iam_role_name" {
  description = "Nombre del rol IAM consultado."
  value       = data.aws_iam_role.existing.name
}
