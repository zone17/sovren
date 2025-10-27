# ============================================================================
# Redis Module Outputs
# ============================================================================

output "environment" {
  description = "Environment for this Redis instance"
  value       = var.environment
}

output "redis_config" {
  description = "Redis configuration profile for the environment"
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
    environment        = var.environment
    configured         = true
    pool_size          = var.connection_pool_size
    tls_enabled        = can(regex("^rediss://", var.redis_url))
  }
}

output "cache_strategy" {
  description = "Cache strategy and TTL configuration"
  value = {
    default_ttl_seconds = local.selected_profile.default_ttl
    default_ttl_minutes = local.selected_profile.default_ttl / 60
    default_ttl_hours   = local.selected_profile.default_ttl / 3600
    eviction_policy     = local.selected_profile.eviction_policy
  }
}

output "free_tier_limits" {
  description = "Free tier limitations and recommendations"
  value = {
    max_memory_limit      = "256MB (Upstash free tier)"
    commands_per_day      = "10,000 (Upstash free tier)"
    connection_limit      = "20 connections"
    recommended_pool_size = var.connection_pool_size
  }
}
