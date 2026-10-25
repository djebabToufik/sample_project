terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.70"
    }
  }

  # State in S3, locked with a lock file (no DynamoDB table needed since Terraform 1.10).
  # The bucket is created once by hand, see README.md.
  backend "s3" {
    bucket       = "djebabtoufik-sample-project-tfstate"
    key          = "live-demo/terraform.tfstate"
    region       = "eu-central-1"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project   = "sample_project"
      ManagedBy = "terraform"
    }
  }
}
