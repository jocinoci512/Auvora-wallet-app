# Least-privilege IAM / service roles interface.

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

variable "service_identities" {
  description = "Microservice names requiring scoped roles"
  type        = list(string)
  default = [
    "gateway",
    "auth",
    "wallet",
    "blockchain",
    "payments",
    "compliance",
    "notifications",
    "analytics",
    "ai",
    "custody",
    "observability",
  ]
}

variable "oidc_provider_arn" {
  description = "K8s OIDC provider for IRSA / workload identity (when applicable)"
  type        = string
  default     = ""
}

variable "tags" {
  type    = map(string)
  default = {}
}

resource "null_resource" "iam_placeholder" {
  count = var.enabled ? 1 : 0

  triggers = {
    services       = join(",", var.service_identities)
    cloud_provider = var.cloud_provider
    environment    = var.environment
  }

  # AWS: aws_iam_role + aws_iam_policy (IRSA trust)
  # Azure: azurerm_user_assigned_identity + role assignments
  # GCP: google_service_account + workload identity binding
}

output "role_arns" {
  description = "Map of service -> role ARN (placeholder)"
  value = var.enabled ? {
    for svc in var.service_identities :
    svc => "arn:placeholder:iam::role/${var.project_name}-${var.environment}-${svc}"
  } : {}
}

output "oidc_provider_arn" {
  value = var.enabled ? coalesce(var.oidc_provider_arn, "placeholder-oidc-arn") : null
}
