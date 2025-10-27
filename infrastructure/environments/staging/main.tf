# ============================================================================
# Sovren Staging Environment (FREE TIER)
# ============================================================================
# Purpose: Production parity testing environment
# Cost: $0/month (using free tier resources)
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
    path = "terraform-staging.tfstate"
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
  environment = "staging"
  project     = "sovren"

  common_tags = {
    Project     = local.project
    Environment = local.environment
    ManagedBy   = "Terraform"
    CostCenter  = "Free Tier"
  }
}

# ============================================================================
# DATABASE MODULE
# ============================================================================

module "database" {
  source = "../../modules/database"

  database_url           = var.database_url
  database_name          = "sovren_staging"
  environment            = local.environment
  backup_enabled         = true
  backup_retention_days  = 7
  max_connections        = 50

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
  max_memory            = "256mb"
  eviction_policy       = "allkeys-lru"
  default_ttl           = 3600
  enable_persistence    = true
  connection_pool_size  = 10

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
  enable_auto_scaling = false

  services = {
    api = {
      image_tag         = "staging-latest"
      cpu_limit         = "0.5"
      memory_limit      = "512m"
      replicas          = 1
      health_check_path = "/health"
    }
    auth = {
      image_tag         = "staging-latest"
      cpu_limit         = "0.5"
      memory_limit      = "512m"
      replicas          = 1
      health_check_path = "/health"
    }
    content = {
      image_tag         = "staging-latest"
      cpu_limit         = "0.5"
      memory_limit      = "512m"
      replicas          = 1
      health_check_path = "/health"
    }
  }

  health_check_interval = 30
  health_check_timeout  = 10
  health_check_retries  = 3

  tags = local.common_tags
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
  description = "Complete deployment summary for staging"
  value = {
    environment      = local.environment
    database_name    = module.database.database_name
    schemas_created  = module.database.schemas_created
    redis_ttl        = module.redis.cache_strategy.default_ttl_hours
    total_services   = module.backend_services.deployment_info.total_services
    service_list     = module.backend_services.service_list
  }
}
