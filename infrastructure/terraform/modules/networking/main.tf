# Cloud-agnostic networking interface (VPC, subnets, IGW).
# Plug in AWS/Azure/GCP provider resources when var.enabled = true.

variable "enabled" {
  description = "When false, no cloud resources are created (offline validate/plan)."
  type        = bool
  default     = false
}

variable "cloud_provider" {
  description = "Target cloud: aws | azure | gcp"
  type        = string
  default     = "aws"

  validation {
    condition     = contains(["aws", "azure", "gcp"], var.cloud_provider)
    error_message = "cloud_provider must be aws, azure, or gcp."
  }
}

variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "vpc_cidr" {
  description = "Primary VPC CIDR block"
  type        = string
  default     = "10.20.0.0/16"
}

variable "public_subnet_count" {
  type    = number
  default = 2
}

variable "tags" {
  type    = map(string)
  default = {}
}

resource "null_resource" "networking_placeholder" {
  count = var.enabled ? 1 : 0

  triggers = {
    cloud_provider = var.cloud_provider
    vpc_cidr       = var.vpc_cidr
    environment    = var.environment
  }

  # AWS: aws_vpc, aws_subnet, aws_internet_gateway
  # Azure: azurerm_virtual_network, azurerm_subnet
  # GCP: google_compute_network, google_compute_subnetwork
}

output "vpc_id" {
  description = "VPC / virtual network identifier (placeholder until provider wired)"
  value       = var.enabled ? "placeholder-vpc-${var.environment}" : null
}

output "public_subnet_ids" {
  description = "Public subnet identifiers"
  value       = var.enabled ? [for i in range(var.public_subnet_count) : "placeholder-public-${var.environment}-${i + 1}"] : []
}

output "internet_gateway_id" {
  description = "Internet gateway / NAT gateway hook"
  value       = var.enabled ? "placeholder-igw-${var.environment}" : null
}
