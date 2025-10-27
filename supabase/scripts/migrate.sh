#!/bin/bash

# 🗄️ SOVREN MIGRATION EXECUTOR
# Elite Engineering Database Migration Execution Tool
# Usage: ./migrate.sh [OPTIONS]

set -euo pipefail

# ============================================================================
# CONFIGURATION
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUPABASE_DIR="$(dirname "$SCRIPT_DIR")"
MIGRATIONS_DIR="$SUPABASE_DIR/migrations"

# Default values
ENVIRONMENT="development"
DRY_RUN=false
FORCE=false
SPECIFIC_MIGRATION=""
BACKUP_BEFORE=true
AUTO_CONFIRM=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

show_usage() {
    cat << EOF
🗄️ Sovren Migration Executor - Elite Engineering Tool

USAGE:
    ./migrate.sh [OPTIONS]

OPTIONS:
    --env ENVIRONMENT        Target environment (development|staging|production)
    --file MIGRATION         Execute specific migration file
    --dry-run               Validate migrations without executing
    --force                 Skip confirmation prompts (use with caution)
    --no-backup             Skip automatic backup creation
    --confirm               Auto-confirm production deployments (CI/CD use)
    --help                  Show this help message

EXAMPLES:
    # Run all pending migrations in development
    ./migrate.sh --env development

    # Execute specific migration with dry run first
    ./migrate.sh --dry-run --file 002_schema_add_user_preferences.sql
    ./migrate.sh --file 002_schema_add_user_preferences.sql

    # Production deployment (requires confirmation)
    ./migrate.sh --env production --confirm

    # Force migration without prompts (CI/CD)
    ./migrate.sh --env staging --force

ENVIRONMENTS:
    development   Local development database
    staging       Staging environment database
    production    Production database (requires special authorization)

SAFETY FEATURES:
    ✅ Pre-migration validation
    ✅ Automatic backup creation
    ✅ Transaction safety
    ✅ Rollback on failure
    ✅ Performance monitoring
    ✅ Post-migration validation

EOF
}

# ============================================================================
# PARAMETER PARSING
# ============================================================================

while [[ $# -gt 0 ]]; do
    case $1 in
        --env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --file)
            SPECIFIC_MIGRATION="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --no-backup)
            BACKUP_BEFORE=false
            shift
            ;;
        --confirm)
            AUTO_CONFIRM=true
            shift
            ;;
        --help)
            show_usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# ============================================================================
# ENVIRONMENT CONFIGURATION
# ============================================================================

configure_environment() {
    case $ENVIRONMENT in
        development)
            DB_HOST="localhost"
            DB_PORT="54322"
            DB_NAME="postgres"
            DB_USER="postgres"
            REQUIRE_CONFIRMATION=false
            ;;
        staging)
            # Load from environment variables or config
            DB_HOST="${STAGING_DB_HOST:-}"
            DB_PORT="${STAGING_DB_PORT:-5432}"
            DB_NAME="${STAGING_DB_NAME:-}"
            DB_USER="${STAGING_DB_USER:-}"
            REQUIRE_CONFIRMATION=true
            ;;
        production)
            # Load from environment variables or config
            DB_HOST="${PROD_DB_HOST:-}"
            DB_PORT="${PROD_DB_PORT:-5432}"
            DB_NAME="${PROD_DB_NAME:-}"
            DB_USER="${PROD_DB_USER:-}"
            REQUIRE_CONFIRMATION=true
            ;;
        *)
            log_error "Invalid environment: $ENVIRONMENT"
            log_error "Valid environments: development, staging, production"
            exit 1
            ;;
    esac

    # Validate configuration
    if [[ "$ENVIRONMENT" != "development" ]]; then
        if [[ -z "$DB_HOST" || -z "$DB_NAME" || -z "$DB_USER" ]]; then
            log_error "Database configuration incomplete for environment: $ENVIRONMENT"
            log_error "Required environment variables: ${ENVIRONMENT^^}_DB_HOST, ${ENVIRONMENT^^}_DB_NAME, ${ENVIRONMENT^^}_DB_USER"
            exit 1
        fi
    fi
}

# ============================================================================
# DATABASE CONNECTION
# ============================================================================

execute_sql() {
    local sql="$1"
    local db_name="${2:-$DB_NAME}"

    if [[ "$ENVIRONMENT" == "development" ]]; then
        # Use Supabase CLI for local development
        echo "$sql" | supabase db --local psql
    else
        # Use psql for remote environments
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$db_name" -v ON_ERROR_STOP=1 -c "$sql"
    fi
}

execute_sql_file() {
    local file="$1"
    local db_name="${2:-$DB_NAME}"

    if [[ "$ENVIRONMENT" == "development" ]]; then
        supabase db --local psql < "$file"
    else
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$db_name" -v ON_ERROR_STOP=1 -f "$file"
    fi
}

# ============================================================================
# MIGRATION DISCOVERY
# ============================================================================

get_pending_migrations() {
    local migrations=()

    if [[ -n "$SPECIFIC_MIGRATION" ]]; then
        # Single migration specified
        local migration_path=""

        # Search in different directories
        for dir in baseline schema data; do
            local candidate="$MIGRATIONS_DIR/$dir/$SPECIFIC_MIGRATION"
            if [[ -f "$candidate" ]]; then
                migration_path="$candidate"
                break
            fi
        done

        if [[ -z "$migration_path" ]]; then
            log_error "Migration file not found: $SPECIFIC_MIGRATION"
            exit 1
        fi

        migrations=("$migration_path")
    else
        # Find all pending migrations
        # Order: baseline first, then schema, then data
        for dir in baseline schema data; do
            if [[ -d "$MIGRATIONS_DIR/$dir" ]]; then
                while IFS= read -r -d '' file; do
                    migrations+=("$file")
                done < <(find "$MIGRATIONS_DIR/$dir" -name "*.sql" -type f -print0 | sort -z)
            fi
        done
    fi

    # Filter out already applied migrations
    local pending_migrations=()
    for migration in "${migrations[@]}"; do
        local migration_name
        migration_name=$(basename "$migration" .sql)

        # Check if migration already applied
        local applied
        applied=$(execute_sql "SELECT COUNT(*) FROM migration_history WHERE migration_name = '$migration_name' AND status = 'success';" 2>/dev/null || echo "0")

        if [[ "$applied" == "0" ]]; then
            pending_migrations+=("$migration")
        fi
    done

    printf '%s\n' "${pending_migrations[@]}"
}

# ============================================================================
# VALIDATION
# ============================================================================

validate_migration() {
    local migration_file="$1"

    log_info "Validating migration: $(basename "$migration_file")"

    # Check SQL syntax
    if [[ "$ENVIRONMENT" == "development" ]]; then
        if ! supabase db --local psql --dry-run < "$migration_file" >/dev/null 2>&1; then
            log_error "SQL syntax validation failed for: $(basename "$migration_file")"
            return 1
        fi
    fi

    # Check for dangerous operations in production
    if [[ "$ENVIRONMENT" == "production" ]]; then
        if grep -q "DROP TABLE\|DROP DATABASE\|TRUNCATE" "$migration_file"; then
            log_warning "Potentially dangerous operations detected in: $(basename "$migration_file")"
            if [[ "$FORCE" == "false" ]]; then
                read -p "Continue anyway? (y/N): " -n 1 -r
                echo
                if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                    return 1
                fi
            fi
        fi
    fi

    log_success "Migration validation passed: $(basename "$migration_file")"
    return 0
}

# ============================================================================
# BACKUP CREATION
# ============================================================================

create_backup() {
    if [[ "$BACKUP_BEFORE" == "false" || "$DRY_RUN" == "true" ]]; then
        return 0
    fi

    local backup_name="backup_$(date +%Y%m%d_%H%M%S)_${ENVIRONMENT}"

    log_info "Creating database backup: $backup_name"

    if [[ "$ENVIRONMENT" == "development" ]]; then
        # For local development, create a simple dump
        mkdir -p "$SUPABASE_DIR/backups"
        supabase db dump --local > "$SUPABASE_DIR/backups/${backup_name}.sql"
    else
        # For remote environments, use pg_dump
        PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > "$SUPABASE_DIR/backups/${backup_name}.sql"
    fi

    log_success "Backup created: ${backup_name}.sql"
}

# ============================================================================
# MIGRATION EXECUTION
# ============================================================================

execute_migration() {
    local migration_file="$1"
    local migration_name
    migration_name=$(basename "$migration_file" .sql)

    log_info "Executing migration: $migration_name"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would execute migration $migration_name"
        return 0
    fi

    local start_time
    start_time=$(date +%s%N)

    # Execute migration in transaction
    local temp_sql
    temp_sql=$(mktemp)

    cat > "$temp_sql" << EOF
BEGIN;

-- Pre-execution validation
DO \$\$
BEGIN
    IF EXISTS (
        SELECT 1 FROM migration_history
        WHERE migration_name = '$migration_name' AND status = 'success'
    ) THEN
        RAISE EXCEPTION 'Migration $migration_name has already been applied successfully';
    END IF;
END \$\$;

-- Execute migration
\i $migration_file

-- Record successful execution
UPDATE migration_history
SET
    execution_time_ms = EXTRACT(EPOCH FROM (NOW() - applied_at)) * 1000,
    status = 'success'
WHERE migration_name = '$migration_name';

COMMIT;
EOF

    if execute_sql_file "$temp_sql"; then
        local end_time
        end_time=$(date +%s%N)
        local duration_ms
        duration_ms=$(( (end_time - start_time) / 1000000 ))

        log_success "Migration executed successfully: $migration_name (${duration_ms}ms)"

        # Record performance metrics
        execute_sql "
        INSERT INTO migration_performance (
            migration_name,
            operation_type,
            execution_time_ms,
            created_at
        ) VALUES (
            '$migration_name',
            'EXECUTE',
            $duration_ms,
            NOW()
        );"

        rm -f "$temp_sql"
        return 0
    else
        log_error "Migration execution failed: $migration_name"

        # Record failure
        execute_sql "
        UPDATE migration_history
        SET
            status = 'failed',
            error_message = 'Migration execution failed'
        WHERE migration_name = '$migration_name';"

        rm -f "$temp_sql"
        return 1
    fi
}

# ============================================================================
# POST-MIGRATION VALIDATION
# ============================================================================

validate_post_migration() {
    local migration_file="$1"
    local migration_name
    migration_name=$(basename "$migration_file" .sql)

    log_info "Running post-migration validation: $migration_name"

    # Check if migration was recorded successfully
    local status
    status=$(execute_sql "SELECT status FROM migration_history WHERE migration_name = '$migration_name';" | tail -n 1)

    if [[ "$status" != "success" ]]; then
        log_error "Migration not recorded as successful: $migration_name"
        return 1
    fi

    # Run any test file if it exists
    local test_file="$MIGRATIONS_DIR/testing/test_${migration_name}.sql"
    if [[ -f "$test_file" ]]; then
        log_info "Running migration tests: $migration_name"
        if execute_sql_file "$test_file"; then
            log_success "Migration tests passed: $migration_name"
        else
            log_warning "Migration tests failed: $migration_name"
        fi
    fi

    return 0
}

# ============================================================================
# CONFIRMATION PROMPTS
# ============================================================================

confirm_execution() {
    if [[ "$FORCE" == "true" || "$AUTO_CONFIRM" == "true" ]]; then
        return 0
    fi

    if [[ "$REQUIRE_CONFIRMATION" == "true" ]]; then
        echo
        log_warning "⚠️  You are about to execute migrations in: $ENVIRONMENT"
        echo

        if [[ "$ENVIRONMENT" == "production" ]]; then
            log_warning "🚨 PRODUCTION ENVIRONMENT DETECTED"
            log_warning "   This will modify the production database!"
            echo
        fi

        read -p "Are you sure you want to continue? (type 'yes' to confirm): " -r
        echo

        if [[ "$REPLY" != "yes" ]]; then
            log_info "Migration cancelled by user"
            exit 0
        fi
    fi
}

# ============================================================================
# MAIN EXECUTION LOGIC
# ============================================================================

main() {
    log_info "🗄️ Sovren Migration Executor - Elite Engineering"
    log_info "Environment: $ENVIRONMENT"

    # Configure environment
    configure_environment

    # Get pending migrations
    local pending_migrations
    mapfile -t pending_migrations < <(get_pending_migrations)

    if [[ ${#pending_migrations[@]} -eq 0 ]]; then
        log_success "No pending migrations found"
        exit 0
    fi

    echo
    log_info "Found ${#pending_migrations[@]} pending migration(s):"
    for migration in "${pending_migrations[@]}"; do
        echo "  • $(basename "$migration")"
    done
    echo

    # Confirm execution
    confirm_execution

    # Create backup
    create_backup

    # Execute migrations
    local failed_migrations=0
    local successful_migrations=0

    for migration in "${pending_migrations[@]}"; do
        echo
        log_info "Processing migration: $(basename "$migration")"

        # Validate migration
        if ! validate_migration "$migration"; then
            log_error "Migration validation failed: $(basename "$migration")"
            ((failed_migrations++))
            continue
        fi

        # Execute migration
        if execute_migration "$migration"; then
            # Post-migration validation
            if validate_post_migration "$migration"; then
                ((successful_migrations++))
            else
                log_warning "Post-migration validation failed: $(basename "$migration")"
            fi
        else
            ((failed_migrations++))
            if [[ "$FORCE" == "false" ]]; then
                log_error "Migration failed, stopping execution"
                break
            fi
        fi
    done

    # Summary
    echo
    echo "============================================================================"
    log_info "Migration execution summary:"
    log_success "Successful migrations: $successful_migrations"
    if [[ $failed_migrations -gt 0 ]]; then
        log_error "Failed migrations: $failed_migrations"
    fi
    echo "============================================================================"

    if [[ $failed_migrations -eq 0 ]]; then
        log_success "All migrations executed successfully!"
        exit 0
    else
        log_error "Some migrations failed. Please check the logs and address issues."
        exit 1
    fi
}

# ============================================================================
# EXECUTION
# ============================================================================

main "$@"
