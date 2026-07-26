# Cloud-agnostic object storage bucket interface.

variable "enabled" {
  type    = bool
  default = false
}

variable "cloud_provider" {
  type    = string
  default = "aws"
}

variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "bucket_name" {
  type    = string
  default = ""
}

variable "versioning_enabled" {
  type    = bool
  default = true
}

variable "encryption_enabled" {
  type    = bool
  default = true
}

variable "lifecycle_days" {
  description = "Days before transitioning to cold storage (0 = disabled)"
  type        = number
  default     = 0
}

variable "tags" {
  type    = map(string)
  default = {}
}

locals {
  resolved_bucket_name = coalesce(
    var.bucket_name,
    "${var.project_name}-${var.environment}-assets"
  )
}

resource "null_resource" "storage_placeholder" {
  count = var.enabled ? 1 : 0

  triggers = {
    bucket_name        = local.resolved_bucket_name
    versioning_enabled = var.versioning_enabled
    cloud_provider     = var.cloud_provider
  }

  # AWS: aws_s3_bucket
  # Azure: azurerm_storage_account + container
  # GCP: google_storage_bucket
}

output "bucket_name" {
  value = var.enabled ? local.resolved_bucket_name : null
}

output "bucket_arn" {
  value = var.enabled ? "arn:placeholder:storage:::${local.resolved_bucket_name}" : null
}

output "bucket_url" {
  value = var.enabled ? "https://${local.resolved_bucket_name}.placeholder.storage" : null
}
