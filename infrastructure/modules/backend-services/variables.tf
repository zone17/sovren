# ============================================================================
# Backend Services Module Variables
# ============================================================================

variable "environment" {
  description = "Environment name (development, staging, production)"
  type        = string

  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, staging, production"
  }
}

variable "services" {
  description = "Map of backend services to deploy with their configurations"
  type = map(object({
    image_tag         = string
    cpu_limit         = string
    memory_limit      = string
    replicas          = number
    health_check_path = string
  }))
  default = {}
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
  description = "Enable auto-scaling (requires paid tier)"
  type        = bool
  default     = false
}

variable "health_check_interval" {
  description = "Interval between health checks (seconds)"
  type        = number
  default     = 30

  validation {
    condition     = var.health_check_interval >= 10 && var.health_check_interval <= 300
    error_message = "Health check interval must be between 10 and 300 seconds"
  }
}

variable "health_check_timeout" {
  description = "Timeout for health check requests (seconds)"
  type        = number
  default     = 10

  validation {
    condition     = var.health_check_timeout >= 5 && var.health_check_timeout <= 60
    error_message = "Health check timeout must be between 5 and 60 seconds"
  }
}

variable "health_check_retries" {
  description = "Number of failed health checks before marking unhealthy"
  type        = number
  default     = 3

  validation {
    condition     = var.health_check_retries >= 1 && var.health_check_retries <= 10
    error_message = "Health check retries must be between 1 and 10"
  }
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
