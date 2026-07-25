variable "aws_region" {
  description = "AWS region for Auvora Wallet infrastructure"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment name"
  type        = string
  default     = "development"
}

variable "project_name" {
  description = "Canonical project identifier"
  type        = string
  default     = "auvora-wallet"
}

variable "vpc_cidr" {
  description = "CIDR block for the platform VPC"
  type        = string
  default     = "10.20.0.0/16"
}
