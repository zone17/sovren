# ============================================================================
# Sovren Backend Services Module (FREE TIER OPTIMIZED)
# ============================================================================
# Provider: Railway.app, Render.com, or Vercel Edge Functions
# Cost: $0/month (within free tier limits)
# ============================================================================

terraform {
  required_version = ">= 1.0"
  required_providers {
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
  }
}

# ============================================================================
# BACKEND SERVICES CONFIGURATION
# ============================================================================

variable "environment" {
  description = "Environment name (development, staging, production)"
  type        = string
}

variable "services" {
  description = "Map of backend services to deploy"
  type = map(object({
    image_tag     = string
    cpu_limit     = string
    memory_limit  = string
    replicas      = number
    health_check_path = string
  }))
}

variable "ghcr_registry" {
  description = "GitHub Container Registry URL"
  type        = string
  default     = "ghcr.io"
}

variable "repository_owner" {
  description = "GitHub repository owner/organization"
  type        = string
}

variable "enable_auto_scaling" {
  description = "Enable auto-scaling (not available in free tier)"
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# ============================================================================
# SERVICE CONFIGURATION PROFILES
# ============================================================================

locals {
  environment_config = {
    development = {
      cpu_limit    = "0.5"
      memory_limit = "512m"
      replicas     = 1
    }
    staging = {
      cpu_limit    = "0.5"
      memory_limit = "512m"
      replicas     = 1
    }
    production = {
      cpu_limit    = "1.0"
      memory_limit = "1024m"
      replicas     = 2
    }
  }

  selected_config = local.environment_config[var.environment]

  # Default services configuration
  default_services = {
    api = {
      image_tag         = "latest"
      cpu_limit         = local.selected_config.cpu_limit
      memory_limit      = local.selected_config.memory_limit
      replicas          = local.selected_config.replicas
      health_check_path = "/health"
    }
    auth = {
      image_tag         = "latest"
      cpu_limit         = local.selected_config.cpu_limit
      memory_limit      = local.selected_config.memory_limit
      replicas          = local.selected_config.replicas
      health_check_path = "/health"
    }
    content = {
      image_tag         = "latest"
      cpu_limit         = local.selected_config.cpu_limit
      memory_limit      = local.selected_config.memory_limit
      replicas          = local.selected_config.replicas
      health_check_path = "/health"
    }
  }

  # Merge provided services with defaults
  services = merge(local.default_services, var.services)
}

# ============================================================================
# SERVICE DEPLOYMENT CONFIGURATION
# ============================================================================

resource "null_resource" "service_config" {
  for_each = local.services

  triggers = {
    service_name  = each.key
    image_tag     = each.value.image_tag
    environment   = var.environment
  }

  provisioner "local-exec" {
    command = <<-EOT
      echo "Configured ${each.key} service for ${var.environment}"
      echo "Image: ${var.ghcr_registry}/${var.repository_owner}/sovren-${each.key}:${each.value.image_tag}"
      echo "Resources: ${each.value.cpu_limit} CPU, ${each.value.memory_limit} Memory"
      echo "Replicas: ${each.value.replicas}"
    EOT
  }
}

# ============================================================================
# OUTPUTS
# ============================================================================

output "services_config" {
  description = "Configuration for all deployed services"
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
  description = "Environment-specific configuration"
  value = local.selected_config
}

output "deployment_info" {
  description = "Deployment information"
  value = {
    environment     = var.environment
    total_services  = length(local.services)
    registry        = var.ghcr_registry
    auto_scaling    = var.enable_auto_scaling
  }
}
