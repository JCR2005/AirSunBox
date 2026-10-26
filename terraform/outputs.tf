output "instance_id" {
  description = "ID de la instancia EC2 administrada por Terraform."
  value       = aws_instance.sanik_iot_prod.id
}

output "vpc_id" {
  description = "ID de la VPC consultada."
  value       = aws_vpc.main.id
}

output "subnet_id" {
  description = "ID de la subnet consultada."
  value       = data.aws_subnet.existing.id
}

output "security_group_id" {
  description = "ID del security group consultado."
  value       = aws_security_group.production.id
}

output "ebs_volume_id" {
  description = "ID del volumen EBS consultado."
  value       = data.aws_ebs_volume.existing.id
}

output "iam_role_name" {
  description = "Nombre del rol IAM consultado."
  value       = data.aws_iam_role.existing.name
}
