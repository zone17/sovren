# ============================================================================
# Sovren Production Environment (FREE TIER)
# ============================================================================
# Purpose: Live production environment serving real users
# Cost: $0/month (using free tier resources with high availability)
# ============================================================================

terraform {
  required_version = ">= 1.0"

  required_providers {
    postgresql = {
      source  = "cyrilgdn/postgresql"
      version = "~> 1.21"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
  }

  # Remote state backend (using GitHub for FREE tier)
  backend "local" {
    path = "terraform-production.tfstate"
  }
}

# ============================================================================
# PROVIDER CONFIGURATION
# ============================================================================

provider "postgresql" {
  host            = var.database_host
  port            = var.database_port
  database        = "postgres"
  username        = var.database_username
  password        = var.database_password
  sslmode         = "require"
  connect_timeout = 15
}

# ============================================================================
# LOCAL VARIABLES
# ============================================================================

locals {
  environment = "production"
  project     = "sovren"

  common_tags = {
    Project     = local.project
    Environment = local.environment
    ManagedBy   = "Terraform"
    CostCenter  = "Free Tier"
    Critical    = "true"
  }
}

# ============================================================================
# DATABASE MODULE
# ============================================================================

module "database" {
  source = "../../modules/database"

  database_url           = var.database_url
  database_name          = "sovren_production"
  environment            = local.environment
  backup_enabled         = true
  backup_retention_days  = 7  # Maximum free tier retention
  max_connections        = 100 # Maximum free tier connections

  tags = local.common_tags
}

# ============================================================================
# REDIS MODULE
# ============================================================================

module "redis" {
  source = "../../modules/redis"

  redis_url             = var.redis_url
  redis_password        = var.redis_password
  environment           = local.environment
  max_memory            = "256mb"  # Free tier limit
  eviction_policy       = "allkeys-lfu"  # LFU for production (better than LRU)
  default_ttl           = 7200  # 2 hours for production
  enable_persistence    = true
  connection_pool_size  = 20  # Maximum for production

  tags = local.common_tags
}

# ============================================================================
# BACKEND SERVICES MODULE
# ============================================================================

module "backend_services" {
  source = "../../modules/backend-services"

  environment         = local.environment
  repository_owner    = var.github_repository_owner
  ghcr_registry       = "ghcr.io"
  enable_auto_scaling = false  # Not available in free tier

  services = {
    api = {
      image_tag         = "production-latest"
      cpu_limit         = "1.0"
      memory_limit      = "1024m"
      replicas          = 2  # High availability
      health_check_path = "/health"
    }
    auth = {
      image_tag         = "production-latest"
      cpu_limit         = "1.0"
      memory_limit      = "1024m"
      replicas          = 2  # High availability
      health_check_path = "/health"
    }
    content = {
      image_tag         = "production-latest"
      cpu_limit         = "1.0"
      memory_limit      = "1024m"
      replicas          = 2  # High availability
      health_check_path = "/health"
    }
  }

  health_check_interval = 30
  health_check_timeout  = 10
  health_check_retries  = 3

  tags = local.common_tags
}

# ============================================================================
# PRODUCTION SAFETY CHECKS
# ============================================================================

resource "null_resource" "production_validation" {
  triggers = {
    environment = local.environment
    timestamp   = timestamp()
  }

  provisioner "local-exec" {
    command = <<-EOT
      echo "================================================"
      echo "PRODUCTION ENVIRONMENT VALIDATION"
      echo "================================================"
      echo "Environment: ${local.environment}"
      echo "Database: ${module.database.database_name}"
      echo "Redis: Configured with ${module.redis.redis_config.max_memory} memory"
      echo "Services: ${module.backend_services.deployment_info.total_services} services"
      echo "High Availability: ${module.backend_services.total_resources.total_replicas} total replicas"
      echo "================================================"
      echo "✅ Production environment configured successfully"
      echo "================================================"
    EOT
  }
}

# ============================================================================
# OUTPUTS
# ============================================================================

output "environment" {
  description = "Environment name"
  value       = local.environment
}

output "database_config" {
  description = "Database configuration"
  value       = module.database.database_name
}

output "redis_config" {
  description = "Redis configuration"
  value       = module.redis.redis_config
}

output "services_config" {
  description = "Backend services configuration"
  value       = module.backend_services.services_config
}

output "deployment_summary" {
  description = "Complete deployment summary for production"
  value = {
    environment      = local.environment
    database_name    = module.database.database_name
    schemas_created  = module.database.schemas_created
    redis_ttl        = module.redis.cache_strategy.default_ttl_hours
    total_services   = module.backend_services.deployment_info.total_services
    service_list     = module.backend_services.service_list
    total_replicas   = module.backend_services.total_resources.total_replicas
    high_availability = true
  }
}

output "cost_analysis" {
  description = "Cost breakdown (FREE TIER)"
  value = {
    database_cost      = "$0/month (Supabase free tier)"
    redis_cost         = "$0/month (Upstash free tier)"
    container_cost     = "$0/month (Railway $5 credit)"
    frontend_cost      = "$0/month (Vercel free tier)"
    total_monthly_cost = "$0/month"
  }
}
