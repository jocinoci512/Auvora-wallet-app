variable "aws_region" {
  description = "AWS region for Auvora Wallet infrastructure"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment name"
  type        = string
  default     = "development"
}

variable "project_name" {
  description = "Canonical project identifier"
  type        = string
  default     = "auvora-wallet"
}

variable "vpc_cidr" {
  description = "CIDR block for the platform VPC"
  type        = string
  default     = "10.20.0.0/16"
}

variable "modules" {
  description = "Optional cloud-agnostic module toggles (all disabled by default)"
  type = object({
    networking = object({
      enabled        = bool
      cloud_provider = optional(string, "aws")
    })
    postgres = object({
      enabled               = bool
      cloud_provider        = optional(string, "aws")
      engine                = optional(string, "postgres")
      instance_size         = optional(string, "small")
      backup_retention_days = optional(number, 7)
    })
    redis = object({
      enabled        = bool
      cloud_provider = optional(string, "aws")
      node_type      = optional(string, "small")
    })
    storage = object({
      enabled        = bool
      cloud_provider = optional(string, "aws")
    })
    secrets = object({
      enabled = bool
      backend = optional(string, "aws_sm")
    })
    iam = object({
      enabled        = bool
      cloud_provider = optional(string, "aws")
    })
    monitoring = object({
      enabled            = bool
      cloud_provider     = optional(string, "aws")
      log_retention_days = optional(number, 30)
      otel_endpoint      = optional(string, "")
    })
    kubernetes = object({
      enabled            = bool
      cloud_provider     = optional(string, "aws")
      kubernetes_version = optional(string, "1.29")
      node_pool_size     = optional(string, "medium")
      node_count_min     = optional(number, 2)
      node_count_max     = optional(number, 6)
    })
    dns = object({
      enabled        = bool
      cloud_provider = optional(string, "aws")
      domain_name    = optional(string, "auvora.example.com")
      subdomain      = optional(string, "")
    })
    loadbalancer = object({
      enabled            = bool
      cloud_provider     = optional(string, "aws")
      ingress_controller = optional(string, "nginx")
      tls_enabled        = optional(bool, true)
      certificate_arn    = optional(string, "")
    })
  })
  default = {
    networking   = { enabled = false, cloud_provider = "aws" }
    postgres     = { enabled = false, cloud_provider = "aws", engine = "postgres", instance_size = "small", backup_retention_days = 7 }
    redis        = { enabled = false, cloud_provider = "aws", node_type = "small" }
    storage      = { enabled = false, cloud_provider = "aws" }
    secrets      = { enabled = false, backend = "aws_sm" }
    iam          = { enabled = false, cloud_provider = "aws" }
    monitoring   = { enabled = false, cloud_provider = "aws", log_retention_days = 30, otel_endpoint = "" }
    kubernetes   = { enabled = false, cloud_provider = "aws", kubernetes_version = "1.29", node_pool_size = "medium", node_count_min = 2, node_count_max = 6 }
    dns          = { enabled = false, cloud_provider = "aws", domain_name = "auvora.example.com", subdomain = "" }
    loadbalancer = { enabled = false, cloud_provider = "aws", ingress_controller = "nginx", tls_enabled = true, certificate_arn = "" }
  }
}
