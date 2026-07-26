# Log and metric sink hooks (cloud-agnostic).

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

variable "log_retention_days" {
  type    = number
  default = 30
}

variable "metrics_enabled" {
  type    = bool
  default = true
}

variable "tracing_enabled" {
  type    = bool
  default = true
}

variable "otel_endpoint" {
  description = "OTLP collector endpoint for in-cluster or managed observability"
  type        = string
  default     = ""
}

variable "alert_email" {
  type    = string
  default = ""
}

variable "tags" {
  type    = map(string)
  default = {}
}

resource "null_resource" "monitoring_placeholder" {
  count = var.enabled ? 1 : 0

  triggers = {
    log_retention   = var.log_retention_days
    metrics_enabled = var.metrics_enabled
    tracing_enabled = var.tracing_enabled
    cloud_provider  = var.cloud_provider
  }

  # AWS: aws_cloudwatch_log_group, aws_cloudwatch_metric_alarm
  # Azure: azurerm_monitor_diagnostic_setting
  # GCP: google_logging_project_sink, google_monitoring_alert_policy
}

output "log_group_name" {
  value = var.enabled ? "/${var.project_name}/${var.environment}" : null
}

output "metrics_namespace" {
  value = var.enabled ? "${var.project_name}/${var.environment}" : null
}

output "otel_endpoint" {
  value = var.enabled ? coalesce(var.otel_endpoint, "http://otel-collector.${var.environment}.internal:4318") : null
}
