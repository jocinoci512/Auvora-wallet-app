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
