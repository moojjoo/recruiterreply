terraform {
  required_version = ">= 1.5.0"

  backend "s3" {
    bucket       = "recruiterreply-terraform-state-178522450316"
    key          = "recruiterreply/test/terraform.tfstate"
    region       = "us-east-1"
    use_lockfile = true
    encrypt      = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.58"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}
