# Optional cloud-agnostic modules — all disabled by default for offline `terraform validate`.
# Enable per environment via envs/<env>/terraform.tfvars.

locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

module "networking" {
  source = "./modules/networking"

  enabled        = var.modules.networking.enabled
  cloud_provider = var.modules.networking.cloud_provider
  project_name   = var.project_name
  environment    = var.environment
  vpc_cidr       = var.vpc_cidr
  tags           = local.common_tags
}

module "postgres" {
  source = "./modules/postgres"

  enabled               = var.modules.postgres.enabled
  cloud_provider        = var.modules.postgres.cloud_provider
  project_name          = var.project_name
  environment           = var.environment
  engine                = var.modules.postgres.engine
  instance_size         = var.modules.postgres.instance_size
  backup_retention_days = var.modules.postgres.backup_retention_days
  vpc_id                = module.networking.vpc_id
  subnet_ids            = module.networking.public_subnet_ids
  tags                  = local.common_tags
}

module "redis" {
  source = "./modules/redis"

  enabled        = var.modules.redis.enabled
  cloud_provider = var.modules.redis.cloud_provider
  project_name   = var.project_name
  environment    = var.environment
  node_type      = var.modules.redis.node_type
  vpc_id         = module.networking.vpc_id
  subnet_ids     = module.networking.public_subnet_ids
  tags           = local.common_tags
}

module "storage" {
  source = "./modules/storage"

  enabled        = var.modules.storage.enabled
  cloud_provider = var.modules.storage.cloud_provider
  project_name   = var.project_name
  environment    = var.environment
  tags           = local.common_tags
}

module "secrets" {
  source = "./modules/secrets"

  enabled      = var.modules.secrets.enabled
  backend      = var.modules.secrets.backend
  project_name = var.project_name
  environment  = var.environment
  tags         = local.common_tags
}

module "iam" {
  source = "./modules/iam"

  enabled        = var.modules.iam.enabled
  cloud_provider = var.modules.iam.cloud_provider
  project_name   = var.project_name
  environment    = var.environment
  tags           = local.common_tags
}

module "monitoring" {
  source = "./modules/monitoring"

  enabled            = var.modules.monitoring.enabled
  cloud_provider     = var.modules.monitoring.cloud_provider
  project_name       = var.project_name
  environment        = var.environment
  log_retention_days = var.modules.monitoring.log_retention_days
  otel_endpoint      = var.modules.monitoring.otel_endpoint
  tags               = local.common_tags
}

module "kubernetes" {
  source = "./modules/kubernetes"

  enabled            = var.modules.kubernetes.enabled
  cloud_provider     = var.modules.kubernetes.cloud_provider
  project_name       = var.project_name
  environment        = var.environment
  kubernetes_version = var.modules.kubernetes.kubernetes_version
  node_pool_size     = var.modules.kubernetes.node_pool_size
  node_count_min     = var.modules.kubernetes.node_count_min
  node_count_max     = var.modules.kubernetes.node_count_max
  vpc_id             = module.networking.vpc_id
  subnet_ids         = module.networking.public_subnet_ids
  tags               = local.common_tags
}

module "dns" {
  source = "./modules/dns"

  enabled        = var.modules.dns.enabled
  cloud_provider = var.modules.dns.cloud_provider
  project_name   = var.project_name
  environment    = var.environment
  domain_name    = var.modules.dns.domain_name
  subdomain      = var.modules.dns.subdomain
  tags           = local.common_tags
}

module "loadbalancer" {
  source = "./modules/loadbalancer"

  enabled            = var.modules.loadbalancer.enabled
  cloud_provider     = var.modules.loadbalancer.cloud_provider
  project_name       = var.project_name
  environment        = var.environment
  ingress_controller = var.modules.loadbalancer.ingress_controller
  tls_enabled        = var.modules.loadbalancer.tls_enabled
  certificate_arn    = var.modules.loadbalancer.certificate_arn
  vpc_id             = module.networking.vpc_id
  subnet_ids         = module.networking.public_subnet_ids
  tags               = local.common_tags
}
