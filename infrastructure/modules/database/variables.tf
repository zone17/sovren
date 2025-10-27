# ============================================================================
# Database Module Variables
# ============================================================================

variable "database_url" {
  description = "PostgreSQL connection string (format: postgresql://user:password@host:port/dbname)"
  type        = string
  sensitive   = true

  validation {
    condition     = can(regex("^postgresql://", var.database_url))
    error_message = "Database URL must be a valid PostgreSQL connection string starting with 'postgresql://'"
  }
}

variable "database_name" {
  description = "Name of the database to create"
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9_]*$", var.database_name))
    error_message = "Database name must start with a letter and contain only lowercase letters, numbers, and underscores"
  }
}

variable "environment" {
  description = "Environment name (development, staging, production)"
  type        = string

  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, staging, production"
  }
}

variable "backup_enabled" {
  description = "Enable automated backups (FREE tier: 7 days retention)"
  type        = bool
  default     = true
}

variable "backup_retention_days" {
  description = "Number of days to retain backups (free tier limit: 7 days)"
  type        = number
  default     = 7

  validation {
    condition     = var.backup_retention_days >= 1 && var.backup_retention_days <= 7
    error_message = "Backup retention must be between 1 and 7 days (free tier limit)"
  }
}

variable "max_connections" {
  description = "Maximum number of database connections (free tier: 100)"
  type        = number
  default     = 50

  validation {
    condition     = var.max_connections >= 10 && var.max_connections <= 100
    error_message = "Max connections must be between 10 and 100 (free tier limit)"
  }
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
