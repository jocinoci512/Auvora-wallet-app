# DNS zone and records interface.

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

variable "domain_name" {
  description = "Root domain (e.g. auvora.example.com)"
  type        = string
  default     = "auvora.example.com"
}

variable "subdomain" {
  description = "Environment subdomain prefix (empty for apex in production)"
  type        = string
  default     = ""
}

variable "records" {
  description = "Map of record name -> { type, value, ttl }"
  type = map(object({
    type  = string
    value = string
    ttl   = optional(number, 300)
  }))
  default = {}
}

variable "tags" {
  type    = map(string)
  default = {}
}

locals {
  fqdn = var.subdomain != "" ? "${var.subdomain}.${var.domain_name}" : var.domain_name
}

resource "null_resource" "dns_placeholder" {
  count = var.enabled ? 1 : 0

  triggers = {
    fqdn           = local.fqdn
    record_count   = length(var.records)
    cloud_provider = var.cloud_provider
  }

  # AWS: aws_route53_zone + aws_route53_record
  # Azure: azurerm_dns_zone + azurerm_dns_a_record
  # GCP: google_dns_managed_zone + google_dns_record_set
}

output "zone_id" {
  value = var.enabled ? "placeholder-zone-${var.environment}" : null
}

output "fqdn" {
  value = var.enabled ? local.fqdn : null
}

output "nameservers" {
  value = var.enabled ? ["ns1.placeholder.dns", "ns2.placeholder.dns"] : []
}
