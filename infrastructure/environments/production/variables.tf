# ============================================================================
# Production Environment Variables
# ============================================================================

# ============================================================================
# DATABASE VARIABLES
# ============================================================================

variable "database_url" {
  description = "PostgreSQL connection URL for production (from Supabase)"
  type        = string
  sensitive   = true
}

variable "database_host" {
  description = "Database host (extracted from database_url for provider)"
  type        = string
  sensitive   = true
}

variable "database_port" {
  description = "Database port"
  type        = number
  default     = 5432
}

variable "database_username" {
  description = "Database username"
  type        = string
  sensitive   = true
}

variable "database_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

# ============================================================================
# REDIS VARIABLES
# ============================================================================

variable "redis_url" {
  description = "Redis connection URL for production"
  type        = string
  sensitive   = true
}

variable "redis_password" {
  description = "Redis password for production"
  type        = string
  sensitive   = true
  default     = ""
}

# ============================================================================
# GITHUB VARIABLES
# ============================================================================

variable "github_repository_owner" {
  description = "GitHub repository owner/organization"
  type        = string
}

# ============================================================================
# PRODUCTION CONFIGURATION
# ============================================================================

variable "enable_debug_logging" {
  description = "Enable debug logging in production (should be false)"
  type        = bool
  default     = false
}

variable "enable_performance_monitoring" {
  description = "Enable performance monitoring in production"
  type        = bool
  default     = true
}

variable "enable_error_tracking" {
  description = "Enable error tracking (Sentry)"
  type        = bool
  default     = true
}

variable "cdn_enabled" {
  description = "Enable CDN for static assets"
  type        = bool
  default     = true
}

# ============================================================================
# SECURITY VARIABLES
# ============================================================================

variable "require_ssl" {
  description = "Require SSL for all connections"
  type        = bool
  default     = true
}

variable "secure_cookies" {
  description = "Use secure cookies only"
  type        = bool
  default     = true
}

variable "helmet_enabled" {
  description = "Enable Helmet security headers"
  type        = bool
  default     = true
}
