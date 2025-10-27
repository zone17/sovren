# ============================================================================
# Database Module Outputs
# ============================================================================

output "database_name" {
  description = "Name of the created database"
  value       = var.database_name
}

output "environment" {
  description = "Environment for this database"
  value       = var.environment
}

output "schemas_created" {
  description = "List of schemas created in the database"
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

output "backup_configuration" {
  description = "Backup configuration details"
  value = {
    enabled         = var.backup_enabled
    retention_days  = var.backup_retention_days
  }
}

output "connection_limits" {
  description = "Connection pool configuration"
  value = {
    max_connections = var.max_connections
  }
}
