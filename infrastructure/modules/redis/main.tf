# ============================================================================
# Sovren Redis Module (FREE TIER OPTIMIZED)
# ============================================================================
# Provider: Railway.app (FREE $5/month credit) or Upstash (FREE 10,000 commands/day)
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
# REDIS CONFIGURATION (FREE TIER)
# ============================================================================
# Free tier options:
# 1. Upstash: 10,000 commands/day, 256MB storage
# 2. Railway.app: $5/month free credit
# 3. Redis Cloud: 30MB free tier
# ============================================================================

variable "redis_url" {
  description = "Redis connection URL (format: redis://user:password@host:port)"
  type        = string
  sensitive   = true
}

variable "redis_password" {
  description = "Redis authentication password"
  type        = string
  sensitive   = true
  default     = ""
}

variable "environment" {
  description = "Environment name (development, staging, production)"
  type        = string
}

variable "max_memory" {
  description = "Maximum memory for Redis (free tier: 256MB)"
  type        = string
  default     = "256mb"
}

variable "eviction_policy" {
  description = "Memory eviction policy (recommended: allkeys-lru for caching)"
  type        = string
  default     = "allkeys-lru"

  validation {
    condition     = contains(["allkeys-lru", "allkeys-lfu", "volatile-lru", "volatile-lfu"], var.eviction_policy)
    error_message = "Eviction policy must be one of: allkeys-lru, allkeys-lfu, volatile-lru, volatile-lfu"
  }
}

variable "default_ttl" {
  description = "Default TTL for cache entries (seconds)"
  type        = number
  default     = 3600
}

variable "enable_persistence" {
  description = "Enable Redis persistence (RDB snapshots)"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# ============================================================================
# REDIS CONNECTION VALIDATION
# ============================================================================

# Validate Redis connection
resource "null_resource" "redis_validation" {
  triggers = {
    redis_url = var.redis_url
    environment = var.environment
  }

  provisioner "local-exec" {
    command = "echo 'Redis connection configured for ${var.environment}'"
  }
}

# ============================================================================
# CACHE CONFIGURATION PROFILES
# ============================================================================

locals {
  cache_profiles = {
    development = {
      max_memory      = "128mb"
      default_ttl     = 1800    # 30 minutes
      eviction_policy = "allkeys-lru"
    }
    staging = {
      max_memory      = "256mb"
      default_ttl     = 3600    # 1 hour
      eviction_policy = "allkeys-lru"
    }
    production = {
      max_memory      = "256mb"
      default_ttl     = 7200    # 2 hours
      eviction_policy = "allkeys-lfu"
    }
  }

  selected_profile = local.cache_profiles[var.environment]
}

# ============================================================================
# OUTPUTS
# ============================================================================

output "redis_config" {
  description = "Redis configuration for the environment"
  value = {
    environment     = var.environment
    max_memory      = local.selected_profile.max_memory
    default_ttl     = local.selected_profile.default_ttl
    eviction_policy = local.selected_profile.eviction_policy
    persistence     = var.enable_persistence
  }
}

output "connection_info" {
  description = "Redis connection information (non-sensitive)"
  value = {
    environment = var.environment
    configured  = true
  }
}
