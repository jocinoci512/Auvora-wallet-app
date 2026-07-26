# Cloud-agnostic Kubernetes cluster + node pool interface.

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

variable "kubernetes_version" {
  type    = string
  default = "1.29"
}

variable "node_pool_size" {
  description = "Cloud-agnostic node pool size token (e.g. small, medium)"
  type        = string
  default     = "medium"
}

variable "node_count_min" {
  type    = number
  default = 2
}

variable "node_count_max" {
  type    = number
  default = 6
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

resource "null_resource" "kubernetes_placeholder" {
  count = var.enabled ? 1 : 0

  triggers = {
    kubernetes_version = var.kubernetes_version
    node_pool_size     = var.node_pool_size
    cloud_provider     = var.cloud_provider
  }

  # AWS: aws_eks_cluster + aws_eks_node_group
  # Azure: azurerm_kubernetes_cluster + node pool
  # GCP: google_container_cluster + node pool
}

output "cluster_name" {
  value = var.enabled ? "${var.project_name}-${var.environment}" : null
}

output "cluster_endpoint" {
  value = var.enabled ? "https://k8s.${var.environment}.internal" : null
}

output "cluster_ca_certificate" {
  value     = var.enabled ? "placeholder-ca-cert" : null
  sensitive = true
}

output "oidc_issuer_url" {
  value = var.enabled ? "https://oidc.${var.environment}.internal" : null
}
