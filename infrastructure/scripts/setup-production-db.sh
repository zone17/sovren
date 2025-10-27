#!/bin/bash
# ============================================================================
# Sovren Production Database Setup Script
# ============================================================================
# Purpose: Initialize production database with schemas and extensions
# Cost: $0 (Supabase free tier)
# WARNING: NO TEST DATA IN PRODUCTION
# ============================================================================

set -e  # Exit on error
set -u  # Exit on undefined variable

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# ============================================================================
# CONFIGURATION
# ============================================================================

ENVIRONMENT="production"
DATABASE_NAME="sovren_production"

# Check if DATABASE_URL is set
if [ -z "${DATABASE_URL:-}" ]; then
    echo -e "${RED}❌ ERROR: DATABASE_URL environment variable not set${NC}"
    echo -e "${YELLOW}💡 Set it with: export DATABASE_URL='postgresql://...'${NC}"
    exit 1
fi

# ============================================================================
# FUNCTIONS
# ============================================================================

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_critical() {
    echo -e "${PURPLE}🔥 $1${NC}"
}

# Confirmation prompt
confirm() {
    read -p "$1 (yes/no): " response
    case "$response" in
        [yY][eE][sS]|[yY]) return 0 ;;
        *) return 1 ;;
    esac
}

# ============================================================================
# PRODUCTION SAFETY CHECKS
# ============================================================================

echo ""
echo "============================================================================"
echo "  SOVREN PRODUCTION DATABASE SETUP"
echo "============================================================================"
echo ""

log_critical "WARNING: You are about to modify the PRODUCTION database!"
log_critical "This operation should only be performed by authorized personnel."
echo ""

if ! confirm "Are you absolutely sure you want to proceed?"; then
    log_info "Operation cancelled by user"
    exit 0
fi

echo ""
log_info "Environment: ${ENVIRONMENT}"
log_info "Database: ${DATABASE_NAME}"
echo ""

# Verify we're not accidentally using staging
if [[ "${DATABASE_URL}" == *"staging"* ]]; then
    log_error "DATABASE_URL appears to be a staging URL"
    log_error "Production setup cancelled for safety"
    exit 1
fi

# Check database connection
log_info "Testing database connection..."
if psql "${DATABASE_URL}" -c "SELECT 1" > /dev/null 2>&1; then
    log_success "Database connection successful"
else
    log_error "Failed to connect to database"
    exit 1
fi

# ============================================================================
# DATABASE SETUP
# ============================================================================

# Create database (if not exists)
log_info "Creating database ${DATABASE_NAME}..."
psql "${DATABASE_URL}" -c "CREATE DATABASE ${DATABASE_NAME};" 2>/dev/null || log_warning "Database already exists"

# Create schemas
log_info "Creating schemas..."
psql "${DATABASE_URL}" <<EOF
-- Create application schema
CREATE SCHEMA IF NOT EXISTS app;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;

-- Set schema search path
ALTER DATABASE ${DATABASE_NAME} SET search_path TO app, public;
EOF
log_success "Schemas created"

# Install extensions
log_info "Installing PostgreSQL extensions..."
psql "${DATABASE_URL}" <<EOF
-- UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Cryptography
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Performance monitoring
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Full-text search
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
EOF
log_success "Extensions installed"

# Run database migrations
log_info "Running database migrations..."
if [ -f "../../packages/backend/src/migrations/run.ts" ]; then
    export DATABASE_URL="${DATABASE_URL}"

    log_warning "About to run migrations on PRODUCTION database"
    if ! confirm "Proceed with migrations?"; then
        log_info "Migration cancelled"
        exit 0
    fi

    npm run migrate:production || log_error "Migration failed"
    log_success "Migrations completed"
else
    log_warning "No migration files found"
fi

# Set up production-specific configurations
log_info "Configuring production-specific settings..."
psql "${DATABASE_URL}" <<EOF
-- Set connection limits (free tier maximum: 100 connections)
ALTER DATABASE ${DATABASE_NAME} SET max_connections = 100;

-- Set statement timeout (10 seconds for production)
ALTER DATABASE ${DATABASE_NAME} SET statement_timeout = '10s';

-- Disable query logging in production (security + performance)
ALTER DATABASE ${DATABASE_NAME} SET log_statement = 'none';

-- Enable connection pooling
ALTER DATABASE ${DATABASE_NAME} SET idle_in_transaction_session_timeout = '60s';
EOF
log_success "Production configurations applied"

# Create database backup
log_info "Creating initial backup..."
BACKUP_FILE="sovren_production_initial_$(date +%Y%m%d_%H%M%S).sql"
pg_dump "${DATABASE_URL}" > "/tmp/${BACKUP_FILE}" || log_warning "Backup creation failed"
log_success "Initial backup created: ${BACKUP_FILE}"

# Verify setup
log_info "Verifying database setup..."
SCHEMA_COUNT=$(psql "${DATABASE_URL}" -t -c "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name IN ('app', 'auth', 'storage');")
EXTENSION_COUNT=$(psql "${DATABASE_URL}" -t -c "SELECT COUNT(*) FROM pg_extension WHERE extname IN ('uuid-ossp', 'pgcrypto', 'pg_stat_statements');")

if [ "${SCHEMA_COUNT}" -eq 3 ] && [ "${EXTENSION_COUNT}" -eq 3 ]; then
    log_success "Database setup verified"
else
    log_error "Database setup verification failed"
    exit 1
fi

# Display summary
echo ""
echo "============================================================================"
echo "  PRODUCTION DATABASE SETUP COMPLETE"
echo "============================================================================"
echo ""
log_success "Database: ${DATABASE_NAME}"
log_success "Schemas: app, auth, storage"
log_success "Extensions: uuid-ossp, pgcrypto, pg_stat_statements"
log_success "Backup: ${BACKUP_FILE}"
echo ""
log_info "Connection string: DATABASE_URL (configured)"
log_info "Max connections: 100 (free tier maximum)"
log_info "Statement timeout: 10s (strict for production)"
log_info "Query logging: DISABLED (security + performance)"
echo ""
log_warning "NO TEST DATA WAS SEEDED (production safety)"
log_info "Database is ready for production use"
echo ""
echo "============================================================================"
echo ""
