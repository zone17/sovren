# ============================================================================
# Backend Services Module Outputs
# ============================================================================

output "environment" {
  description = "Environment for these backend services"
  value       = var.environment
}

output "services_config" {
  description = "Complete configuration for all deployed services"
  value = {
    for service_name, service_config in local.services :
    service_name => {
      image         = "${var.ghcr_registry}/${var.repository_owner}/sovren-${service_name}:${service_config.image_tag}"
      cpu_limit     = service_config.cpu_limit
      memory_limit  = service_config.memory_limit
      replicas      = service_config.replicas
      health_check  = service_config.health_check_path
    }
  }
}

output "environment_config" {
  description = "Environment-specific resource configuration"
  value = local.selected_config
}

output "deployment_info" {
  description = "High-level deployment information"
  value = {
    environment     = var.environment
    total_services  = length(local.services)
    registry        = var.ghcr_registry
    repository      = var.repository_owner
    auto_scaling    = var.enable_auto_scaling
  }
}

output "health_check_config" {
  description = "Health check configuration"
  value = {
    interval_seconds = var.health_check_interval
    timeout_seconds  = var.health_check_timeout
    retries          = var.health_check_retries
  }
}

output "service_list" {
  description = "List of all service names"
  value       = keys(local.services)
}

output "total_resources" {
  description = "Total resource allocation across all services"
  value = {
    total_replicas = sum([for s in local.services : s.replicas])
    total_cpu      = sum([for s in local.services : tonumber(s.cpu_limit) * s.replicas])
    environment    = var.environment
  }
}
