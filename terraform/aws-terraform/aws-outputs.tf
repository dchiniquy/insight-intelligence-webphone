output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "Private subnet IDs"  
  value       = aws_subnet.private[*].id
}

output "load_balancer_dns_name" {
  description = "Load balancer DNS name"
  value       = aws_lb.webphone.dns_name
}

output "load_balancer_zone_id" {
  description = "Load balancer hosted zone ID"
  value       = aws_lb.webphone.zone_id
}

output "backend_repository_url" {
  description = "ECR repository URL for backend"
  value       = aws_ecr_repository.webphone_backend.repository_url
}

output "frontend_repository_url" {
  description = "ECR repository URL for frontend"
  value       = aws_ecr_repository.webphone_frontend.repository_url
}

output "certificate_arn" {
  description = "ACM certificate ARN"
  value       = var.domain_name != "" ? aws_acm_certificate.webphone[0].arn : null
}

output "route53_zone_id" {
  description = "Route 53 hosted zone ID"
  value       = var.domain_name != "" && var.use_route53 ? aws_route53_zone.main[0].zone_id : null
}

output "route53_name_servers" {
  description = "Route 53 name servers"
  value       = var.domain_name != "" && var.use_route53 ? aws_route53_zone.main[0].name_servers : null
}

output "ssl_setup_instructions" {
  description = "Instructions for SSL certificate setup"
  value = var.domain_name != "" ? (
    var.use_route53 ? 
    "SSL certificate will be automatically validated via Route 53. Update your domain's name servers to: ${join(", ", aws_route53_zone.main[0].name_servers)}" :
    "SSL certificate created. Add these DNS records to validate: ${jsonencode([for dvo in aws_acm_certificate.webphone[0].domain_validation_options : "${dvo.resource_record_name} ${dvo.resource_record_type} ${dvo.resource_record_value}"])}"
  ) : "No domain specified - SSL not configured"
}