# ============================================================================
# Staging Environment Variables
# ============================================================================

# ============================================================================
# DATABASE VARIABLES
# ============================================================================

variable "database_url" {
  description = "PostgreSQL connection URL for staging (from Supabase)"
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
  description = "Redis connection URL for staging"
  type        = string
  sensitive   = true
}

variable "redis_password" {
  description = "Redis password for staging"
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
# ENVIRONMENT CONFIGURATION
# ============================================================================

variable "enable_debug_logging" {
  description = "Enable debug logging in staging"
  type        = bool
  default     = true
}

variable "enable_performance_monitoring" {
  description = "Enable performance monitoring in staging"
  type        = bool
  default     = true
}
