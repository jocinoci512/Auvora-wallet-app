# Cloud-agnostic Redis / cache interface.

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

variable "node_type" {
  description = "Cloud-agnostic size token (e.g. cache.t3.micro equivalent)"
  type        = string
  default     = "small"
}

variable "engine_version" {
  type    = string
  default = "7"
}

variable "replica_count" {
  type    = number
  default = 0
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

resource "null_resource" "redis_placeholder" {
  count = var.enabled ? 1 : 0

  triggers = {
    node_type      = var.node_type
    engine_version = var.engine_version
    cloud_provider = var.cloud_provider
  }

  # AWS: aws_elasticache_cluster / replication_group
  # Azure: azurerm_redis_cache
  # GCP: google_redis_instance
}

output "endpoint" {
  value = var.enabled ? "redis.${var.environment}.internal" : null
}

output "port" {
  value = var.enabled ? 6379 : null
}

output "connection_secret_name" {
  value = var.enabled ? "${var.project_name}/${var.environment}/redis" : null
}
