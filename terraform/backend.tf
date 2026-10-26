terraform {
  backend "s3" {
    bucket       = "sanik-iot-terraform-state-009644552142-us-east-2"
    key          = "airsunbox/terraform.tfstate"
    region       = "us-east-2"
    encrypt      = true
    use_lockfile = true
  }
}
