#!/bin/bash
# ============================================================================
# Sovren Staging Database Setup Script
# ============================================================================
# Purpose: Initialize staging database with schemas, extensions, and test data
# Cost: $0 (Supabase free tier)
# ============================================================================

set -e  # Exit on error
set -u  # Exit on undefined variable

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# CONFIGURATION
# ============================================================================

ENVIRONMENT="staging"
DATABASE_NAME="sovren_staging"

# Check if DATABASE_URL_STAGING is set
if [ -z "${DATABASE_URL_STAGING:-}" ]; then
    echo -e "${RED}❌ ERROR: DATABASE_URL_STAGING environment variable not set${NC}"
    echo -e "${YELLOW}💡 Set it with: export DATABASE_URL_STAGING='postgresql://...'${NC}"
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

# ============================================================================
# DATABASE SETUP
# ============================================================================

echo ""
echo "============================================================================"
echo "  SOVREN STAGING DATABASE SETUP"
echo "============================================================================"
echo ""

log_info "Environment: ${ENVIRONMENT}"
log_info "Database: ${DATABASE_NAME}"
echo ""

# Check database connection
log_info "Testing database connection..."
if psql "${DATABASE_URL_STAGING}" -c "SELECT 1" > /dev/null 2>&1; then
    log_success "Database connection successful"
else
    log_error "Failed to connect to database"
    exit 1
fi

# Create database (if not exists)
log_info "Creating database ${DATABASE_NAME}..."
psql "${DATABASE_URL_STAGING}" -c "CREATE DATABASE ${DATABASE_NAME};" 2>/dev/null || log_warning "Database already exists"

# Create schemas
log_info "Creating schemas..."
psql "${DATABASE_URL_STAGING}" <<EOF
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
psql "${DATABASE_URL_STAGING}" <<EOF
-- UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Cryptography
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Performance monitoring
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Full-text search (optional)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
EOF
log_success "Extensions installed"

# Run database migrations
log_info "Running database migrations..."
if [ -f "../../packages/backend/src/migrations/run.ts" ]; then
    export DATABASE_URL="${DATABASE_URL_STAGING}"
    npm run migrate:staging || log_warning "No migrations to run"
    log_success "Migrations completed"
else
    log_warning "No migration files found"
fi

# Seed test data for staging
log_info "Seeding staging test data..."
psql "${DATABASE_URL_STAGING}" <<EOF
-- Insert staging test data
INSERT INTO app.users (id, email, username, created_at)
VALUES
    (uuid_generate_v4(), 'test@staging.sovren.dev', 'staging_user_1', NOW()),
    (uuid_generate_v4(), 'test2@staging.sovren.dev', 'staging_user_2', NOW())
ON CONFLICT DO NOTHING;

-- Add test content
INSERT INTO app.content (id, title, body, user_id, created_at)
SELECT
    uuid_generate_v4(),
    'Test Content ' || generate_series,
    'This is test content for staging environment',
    (SELECT id FROM app.users LIMIT 1),
    NOW()
FROM generate_series(1, 10)
ON CONFLICT DO NOTHING;
EOF
log_success "Test data seeded"

# Set up staging-specific configurations
log_info "Configuring staging-specific settings..."
psql "${DATABASE_URL_STAGING}" <<EOF
-- Set connection limits (free tier: 50 connections)
ALTER DATABASE ${DATABASE_NAME} SET max_connections = 50;

-- Set statement timeout (30 seconds for staging)
ALTER DATABASE ${DATABASE_NAME} SET statement_timeout = '30s';

-- Enable query logging for debugging
ALTER DATABASE ${DATABASE_NAME} SET log_statement = 'all';
EOF
log_success "Staging configurations applied"

# Verify setup
log_info "Verifying database setup..."
SCHEMA_COUNT=$(psql "${DATABASE_URL_STAGING}" -t -c "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name IN ('app', 'auth', 'storage');")
EXTENSION_COUNT=$(psql "${DATABASE_URL_STAGING}" -t -c "SELECT COUNT(*) FROM pg_extension WHERE extname IN ('uuid-ossp', 'pgcrypto', 'pg_stat_statements');")

if [ "${SCHEMA_COUNT}" -eq 3 ] && [ "${EXTENSION_COUNT}" -eq 3 ]; then
    log_success "Database setup verified"
else
    log_error "Database setup verification failed"
    exit 1
fi

# Display summary
echo ""
echo "============================================================================"
echo "  STAGING DATABASE SETUP COMPLETE"
echo "============================================================================"
echo ""
log_success "Database: ${DATABASE_NAME}"
log_success "Schemas: app, auth, storage"
log_success "Extensions: uuid-ossp, pgcrypto, pg_stat_statements"
log_success "Test data: Seeded"
echo ""
log_info "Connection string: DATABASE_URL_STAGING (configured)"
log_info "Max connections: 50 (free tier)"
log_info "Statement timeout: 30s"
echo ""
echo "============================================================================"
echo ""
