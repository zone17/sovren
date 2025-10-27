# ============================================================================
# Sovren Database Module (FREE TIER OPTIMIZED)
# ============================================================================
# Provider: AWS Free Tier or Supabase (PostgreSQL)
# Cost: $0/month (using Supabase free tier or AWS Free Tier RDS)
# ============================================================================

terraform {
  required_version = ">= 1.0"
  required_providers {
    postgresql = {
      source  = "cyrilgdn/postgresql"
      version = "~> 1.21"
    }
  }
}

# ============================================================================
# SUPABASE PROJECT (FREE TIER)
# ============================================================================
# Note: Supabase free tier includes:
# - 500MB database storage
# - Unlimited API requests
# - 50,000 monthly active users
# - 2GB file storage
# ============================================================================

# Database connection (uses Supabase connection string)
variable "database_url" {
  description = "PostgreSQL connection string (from Supabase or RDS)"
  type        = string
  sensitive   = true
}

variable "database_name" {
  description = "Name of the database to create"
  type        = string
}

variable "environment" {
  description = "Environment name (development, staging, production)"
  type        = string
}

variable "backup_enabled" {
  description = "Enable automated backups"
  type        = bool
  default     = true
}

variable "backup_retention_days" {
  description = "Number of days to retain backups (free tier: 7 days)"
  type        = number
  default     = 7
}

# ============================================================================
# DATABASE CONFIGURATION
# ============================================================================

# Database schema
resource "postgresql_schema" "app" {
  name     = "app"
  database = var.database_name

  lifecycle {
    prevent_destroy = true
  }
}

# Authentication schema (for Supabase auth)
resource "postgresql_schema" "auth" {
  name     = "auth"
  database = var.database_name

  lifecycle {
    prevent_destroy = true
  }
}

# Storage schema (for Supabase storage)
resource "postgresql_schema" "storage" {
  name     = "storage"
  database = var.database_name

  lifecycle {
    prevent_destroy = true
  }
}

# ============================================================================
# DATABASE EXTENSIONS
# ============================================================================

resource "postgresql_extension" "uuid_ossp" {
  name     = "uuid-ossp"
  database = var.database_name
  schema   = "public"
}

resource "postgresql_extension" "pgcrypto" {
  name     = "pgcrypto"
  database = var.database_name
  schema   = "public"
}

resource "postgresql_extension" "pg_stat_statements" {
  name     = "pg_stat_statements"
  database = var.database_name
  schema   = "public"
}

# ============================================================================
# OUTPUTS
# ============================================================================

output "database_name" {
  description = "Name of the created database"
  value       = var.database_name
}

output "schemas_created" {
  description = "List of schemas created"
  value       = [
    postgresql_schema.app.name,
    postgresql_schema.auth.name,
    postgresql_schema.storage.name
  ]
}

output "extensions_enabled" {
  description = "List of enabled PostgreSQL extensions"
  value       = [
    postgresql_extension.uuid_ossp.name,
    postgresql_extension.pgcrypto.name,
    postgresql_extension.pg_stat_statements.name
  ]
}
