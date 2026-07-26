# Cloud-agnostic secret store interface.
# backend: vault | aws_sm | azure_kv | k8s

variable "enabled" {
  type    = bool
  default = false
}

variable "backend" {
  description = "Secret backend: vault | aws_sm | azure_kv | k8s"
  type        = string
  default     = "aws_sm"

  validation {
    condition     = contains(["vault", "aws_sm", "azure_kv", "k8s"], var.backend)
    error_message = "backend must be vault, aws_sm, azure_kv, or k8s."
  }
}

variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "vault_address" {
  type    = string
  default = ""
}

variable "k8s_namespace" {
  type    = string
  default = "auvora-wallet"
}

variable "secret_names" {
  description = "Logical secret keys to provision placeholders for"
  type        = list(string)
  default = [
    "database-url",
    "redis-url",
    "jwt-access-secret",
    "jwt-refresh-secret",
    "internal-api-key",
  ]
}

variable "tags" {
  type    = map(string)
  default = {}
}

resource "null_resource" "secrets_placeholder" {
  count = var.enabled ? 1 : 0

  triggers = {
    backend     = var.backend
    secret_keys = join(",", var.secret_names)
    environment = var.environment
  }

  # vault: vault_generic_secret
  # aws_sm: aws_secretsmanager_secret
  # azure_kv: azurerm_key_vault_secret
  # k8s: kubernetes_secret (via helm/kustomize in cluster)
}

output "backend" {
  value = var.enabled ? var.backend : null
}

output "secret_arns" {
  description = "Map of logical name -> provider ARN/URI (placeholder)"
  value = var.enabled ? {
    for name in var.secret_names :
    name => "placeholder://${var.backend}/${var.project_name}/${var.environment}/${name}"
  } : {}
}

output "k8s_namespace" {
  value = var.enabled && var.backend == "k8s" ? var.k8s_namespace : null
}
