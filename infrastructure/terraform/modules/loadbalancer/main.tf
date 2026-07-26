# Load balancer and ingress controller hooks.

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

variable "ingress_controller" {
  description = "Ingress implementation: nginx | traefik | aws_alb | gce"
  type        = string
  default     = "nginx"
}

variable "tls_enabled" {
  type    = bool
  default = true
}

variable "certificate_arn" {
  description = "ACM / Key Vault / Certificate Manager ARN or ID"
  type        = string
  default     = ""
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

resource "null_resource" "loadbalancer_placeholder" {
  count = var.enabled ? 1 : 0

  triggers = {
    ingress_controller = var.ingress_controller
    tls_enabled        = var.tls_enabled
    cloud_provider     = var.cloud_provider
  }

  # AWS: aws_lb + aws_lb_listener (or ALB ingress controller via helm)
  # Azure: azurerm_public_ip + Application Gateway
  # GCP: google_compute_global_address + GCE ingress
}

output "load_balancer_dns" {
  value = var.enabled ? "lb.${var.environment}.${var.project_name}.placeholder" : null
}

output "ingress_class" {
  value = var.enabled ? var.ingress_controller : null
}

output "certificate_arn" {
  value = var.enabled ? coalesce(var.certificate_arn, "placeholder-cert-arn") : null
}
