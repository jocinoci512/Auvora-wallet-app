provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "auvora-wallet"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
