# Cloud-agnostic managed Postgres interface.
# Map engine, size, and backup_retention to RDS / Azure DB / Cloud SQL when enabled.

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

variable "engine" {
  description = "Database engine (e.g. postgres)"
  type        = string
  default     = "postgres"
}

variable "engine_version" {
  type    = string
  default = "16"
}

variable "instance_size" {
  description = "Cloud-agnostic size token (e.g. small, medium, large)"
  type        = string
  default     = "small"
}

variable "backup_retention_days" {
  type    = number
  default = 7
}

variable "database_name" {
  type    = string
  default = "auvora_wallet"
}

variable "vpc_id" {
  type    = string
  default = ""
}

variable "subnet_ids" {
  type    = list(string)
  default = []
}

variable "tags" {
  type    = map(string)
  default = {}
}

resource "null_resource" "postgres_placeholder" {
  count = var.enabled ? 1 : 0

  triggers = {
    engine           = var.engine
    instance_size    = var.instance_size
    backup_retention = var.backup_retention_days
    cloud_provider   = var.cloud_provider
  }

  # AWS: aws_db_instance
  # Azure: azurerm_postgresql_flexible_server
  # GCP: google_sql_database_instance
}

output "endpoint" {
  description = "Postgres hostname (placeholder)"
  value       = var.enabled ? "postgres.${var.environment}.internal" : null
}

output "port" {
  value = var.enabled ? 5432 : null
}

output "database_name" {
  value = var.enabled ? var.database_name : null
}

output "connection_secret_name" {
  description = "Secret store key for credentials"
  value       = var.enabled ? "${var.project_name}/${var.environment}/postgres" : null
}
