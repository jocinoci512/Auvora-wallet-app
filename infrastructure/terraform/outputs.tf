output "vpc_id" {
  description = "ID of the Auvora Wallet VPC"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "Public subnet IDs for edge-facing workloads"
  value       = aws_subnet.public[*].id
}

output "internet_gateway_id" {
  description = "Internet gateway attached to the VPC"
  value       = aws_internet_gateway.main.id
}

output "module_postgres_endpoint" {
  description = "Managed Postgres endpoint (when module enabled)"
  value       = module.postgres.endpoint
}

output "module_redis_endpoint" {
  description = "Managed Redis endpoint (when module enabled)"
  value       = module.redis.endpoint
}

output "module_kubernetes_cluster_name" {
  description = "Kubernetes cluster name (when module enabled)"
  value       = module.kubernetes.cluster_name
}

output "module_loadbalancer_dns" {
  description = "Load balancer DNS (when module enabled)"
  value       = module.loadbalancer.load_balancer_dns
}
