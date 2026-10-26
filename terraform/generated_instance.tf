# __generated__ by Terraform
# Please review these resources and move them into your main configuration files.

# __generated__ by Terraform
resource "aws_instance" "sanik_iot_prod" {
  ami                                  = "ami-02ad619be5bc165df"
  availability_zone                    = "us-east-2c"
  disable_api_stop                     = false
  disable_api_termination              = false
  ebs_optimized                        = true
  force_destroy                        = false
  get_password_data                    = false
  hibernation                          = false
  iam_instance_profile                 = "sanik-iot-ec2-role"
  instance_initiated_shutdown_behavior = "stop"
  instance_type                        = "t3.small"
  key_name                             = "ec2_nodo_sucursal3"
  monitoring                           = false
  placement_partition_number           = 0
  private_ip                           = "172.31.46.80"
  region                               = "us-east-2"
  secondary_private_ips                = []
  security_groups                      = ["launch-wizard-3"]
  source_dest_check                    = true
  subnet_id                            = "subnet-0895cb767c6c30462"
  tags = {
    Name = "sanik-iot-prod"
  }
  tags_all = {
    Name = "sanik-iot-prod"
  }
  tenancy                     = "default"
  user_data                   = null
  user_data_replace_on_change = null
  volume_tags                 = null
  vpc_security_group_ids      = ["sg-0a416718e89d5e784"]
  capacity_reservation_specification {
    capacity_reservation_preference = "open"
  }
  cpu_options {
    core_count       = 1
    threads_per_core = 2
  }
  credit_specification {
    cpu_credits = "unlimited"
  }
  enclave_options {
    enabled = false
  }
  maintenance_options {
    auto_recovery = "default"
  }
  metadata_options {
    http_endpoint               = "enabled"
    http_protocol_ipv6          = "disabled"
    http_put_response_hop_limit = 2
    http_tokens                 = "required"
    instance_metadata_tags      = "disabled"
  }
  private_dns_name_options {
    enable_resource_name_dns_a_record    = true
    enable_resource_name_dns_aaaa_record = false
    hostname_type                        = "ip-name"
  }
  root_block_device {
    delete_on_termination = true
    encrypted             = false
    iops                  = 3000
    tags                  = {}
    tags_all              = {}
    throughput            = 125
    volume_size           = 20
    volume_type           = "gp3"
  }
}
