# ============================================================================
# Redis Module Variables
# ============================================================================

variable "redis_url" {
  description = "Redis connection URL (format: redis://user:password@host:port or rediss:// for TLS)"
  type        = string
  sensitive   = true

  validation {
    condition     = can(regex("^redis(s)?://", var.redis_url))
    error_message = "Redis URL must start with 'redis://' or 'rediss://' for TLS connections"
  }
}

variable "redis_password" {
  description = "Redis authentication password (leave empty if using password in URL)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "environment" {
  description = "Environment name (development, staging, production)"
  type        = string

  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, staging, production"
  }
}

variable "max_memory" {
  description = "Maximum memory for Redis (free tier limit: 256MB)"
  type        = string
  default     = "256mb"

  validation {
    condition     = can(regex("^[0-9]+(mb|gb)$", var.max_memory))
    error_message = "Max memory must be in format '256mb' or '1gb'"
  }
}

variable "eviction_policy" {
  description = "Memory eviction policy when max_memory is reached"
  type        = string
  default     = "allkeys-lru"

  validation {
    condition     = contains([
      "allkeys-lru",   # Evict any key using LRU (recommended for cache)
      "allkeys-lfu",   # Evict any key using LFU
      "volatile-lru",  # Evict keys with TTL using LRU
      "volatile-lfu",  # Evict keys with TTL using LFU
      "noeviction"     # Return errors when memory limit reached
    ], var.eviction_policy)
    error_message = "Eviction policy must be one of: allkeys-lru, allkeys-lfu, volatile-lru, volatile-lfu, noeviction"
  }
}

variable "default_ttl" {
  description = "Default TTL for cache entries in seconds"
  type        = number
  default     = 3600

  validation {
    condition     = var.default_ttl >= 60 && var.default_ttl <= 86400
    error_message = "Default TTL must be between 60 seconds (1 min) and 86400 seconds (24 hours)"
  }
}

variable "enable_persistence" {
  description = "Enable Redis persistence (RDB snapshots)"
  type        = bool
  default     = true
}

variable "connection_pool_size" {
  description = "Maximum number of Redis connections in pool (free tier: 10-20)"
  type        = number
  default     = 10

  validation {
    condition     = var.connection_pool_size >= 5 && var.connection_pool_size <= 20
    error_message = "Connection pool size must be between 5 and 20 (free tier limit)"
  }
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
