#!/bin/bash

# 🗄️ SOVREN MIGRATION GENERATOR
# Elite Engineering Database Migration Generation Tool
# Usage: ./generate.sh --type [table|index|constraint|data] --name [description]

set -euo pipefail

# ============================================================================
# CONFIGURATION
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUPABASE_DIR="$(dirname "$SCRIPT_DIR")"
MIGRATIONS_DIR="$SUPABASE_DIR/migrations"
TEMPLATES_DIR="$MIGRATIONS_DIR/templates"

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
🗄️ Sovren Migration Generator - Elite Engineering Tool

USAGE:
    ./generate.sh --type TYPE --name DESCRIPTION [OPTIONS]

TYPES:
    table       Create table migration (create/alter tables)
    index       Create index migration (add/drop indexes)
    constraint  Create constraint migration (add/drop constraints)
    data        Create data migration (data transformations)
    baseline    Create baseline migration (full schema snapshot)
    rollback    Create rollback migration for existing migration

OPTIONS:
    --type TYPE          Migration type (required)
    --name DESCRIPTION   Migration description (required)
    --author AUTHOR      Migration author (default: current user)
    --table TABLE        Target table name (for specific migrations)
    --breaking           Mark as breaking change
    --hotfix            Create hotfix migration with special naming
    --help              Show this help message

EXAMPLES:
    # Create table migration
    ./generate.sh --type table --name "add_user_preferences"

    # Create index migration for specific table
    ./generate.sh --type index --name "optimize_content_queries" --table content

    # Create data migration with breaking changes
    ./generate.sh --type data --name "migrate_payment_structure" --breaking

    # Create hotfix migration
    ./generate.sh --type constraint --name "fix_user_constraint" --hotfix

    # Create rollback for existing migration
    ./generate.sh --type rollback --name "rollback_user_preferences"

DIRECTORY STRUCTURE:
    migrations/
    ├── baseline/           # Baseline migrations
    ├── schema/            # Schema change migrations
    ├── data/              # Data transformation migrations
    ├── rollbacks/         # Rollback migrations
    └── templates/         # Migration templates

EOF
}

# ============================================================================
# PARAMETER PARSING
# ============================================================================

MIGRATION_TYPE=""
MIGRATION_NAME=""
AUTHOR="$(whoami)"
TARGET_TABLE=""
BREAKING_CHANGE=false
IS_HOTFIX=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --type)
            MIGRATION_TYPE="$2"
            shift 2
            ;;
        --name)
            MIGRATION_NAME="$2"
            shift 2
            ;;
        --author)
            AUTHOR="$2"
            shift 2
            ;;
        --table)
            TARGET_TABLE="$2"
            shift 2
            ;;
        --breaking)
            BREAKING_CHANGE=true
            shift
            ;;
        --hotfix)
            IS_HOTFIX=true
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
# VALIDATION
# ============================================================================

validate_parameters() {
    if [[ -z "$MIGRATION_TYPE" ]]; then
        log_error "Migration type is required. Use --type [table|index|constraint|data|baseline|rollback]"
        exit 1
    fi

    if [[ -z "$MIGRATION_NAME" ]]; then
        log_error "Migration name is required. Use --name 'description'"
        exit 1
    fi

    # Validate migration type
    case $MIGRATION_TYPE in
        table|index|constraint|data|baseline|rollback)
            ;;
        *)
            log_error "Invalid migration type: $MIGRATION_TYPE"
            log_error "Valid types: table, index, constraint, data, baseline, rollback"
            exit 1
            ;;
    esac

    # Validate migration name format
    if [[ ! "$MIGRATION_NAME" =~ ^[a-zA-Z0-9_-]+$ ]]; then
        log_error "Migration name must contain only letters, numbers, underscores, and hyphens"
        exit 1
    fi

    # Create directories if they don't exist
    mkdir -p "$MIGRATIONS_DIR"/{baseline,schema,data,rollbacks,testing,utilities}
    mkdir -p "$TEMPLATES_DIR"
}

# ============================================================================
# TIMESTAMP GENERATION
# ============================================================================

generate_timestamp() {
    if [[ "$MIGRATION_TYPE" == "baseline" ]]; then
        # For baseline migrations, use sequential numbers
        local last_baseline
        last_baseline=$(find "$MIGRATIONS_DIR/baseline" -name "*.sql" 2>/dev/null | \
                       sed 's/.*\/\([0-9]\+\)_.*/\1/' | \
                       sort -n | tail -1)

        if [[ -z "$last_baseline" ]]; then
            echo "001"
        else
            printf "%03d" $((last_baseline + 1))
        fi
    else
        # For regular migrations, use UTC timestamp
        if [[ "$IS_HOTFIX" == "true" ]]; then
            echo "$(date -u '+%Y%m%d%H%M%S')_hotfix"
        else
            date -u '+%Y%m%d%H%M%S'
        fi
    fi
}

# ============================================================================
# TEMPLATE SELECTION AND CUSTOMIZATION
# ============================================================================

get_template_file() {
    case $MIGRATION_TYPE in
        table)
            echo "$TEMPLATES_DIR/table-migration.sql"
            ;;
        index)
            echo "$TEMPLATES_DIR/index-migration.sql"
            ;;
        constraint)
            echo "$TEMPLATES_DIR/constraint-migration.sql"
            ;;
        data)
            echo "$TEMPLATES_DIR/data-migration.sql"
            ;;
        rollback)
            echo "$TEMPLATES_DIR/rollback-template.sql"
            ;;
        baseline)
            echo "$TEMPLATES_DIR/table-migration.sql"  # Use table template as base
            ;;
        *)
            log_error "No template available for migration type: $MIGRATION_TYPE"
            exit 1
            ;;
    esac
}

get_output_directory() {
    case $MIGRATION_TYPE in
        baseline)
            echo "$MIGRATIONS_DIR/baseline"
            ;;
        rollback)
            echo "$MIGRATIONS_DIR/rollbacks"
            ;;
        data)
            echo "$MIGRATIONS_DIR/data"
            ;;
        *)
            echo "$MIGRATIONS_DIR/schema"
            ;;
    esac
}

customize_template() {
    local template_file="$1"
    local output_file="$2"
    local timestamp="$3"
    local migration_name="${timestamp}_${MIGRATION_TYPE}_${MIGRATION_NAME}"

    if [[ ! -f "$template_file" ]]; then
        log_error "Template file not found: $template_file"
        exit 1
    fi

    # Copy template and customize
    cp "$template_file" "$output_file"

    # Replace template placeholders
    sed -i.bak \
        -e "s/\[TIMESTAMP\]/$timestamp/g" \
        -e "s/\[TYPE\]/$MIGRATION_TYPE/g" \
        -e "s/\[DESCRIPTION\]/$MIGRATION_NAME/g" \
        -e "s/\[DETAILED_DESCRIPTION\]/Migration to $MIGRATION_NAME/g" \
        -e "s/\[AUTHOR_NAME\]/$AUTHOR/g" \
        -e "s/\[DATE\]/$(date -u '+%Y-%m-%d')/g" \
        -e "s/\[MIGRATION_NAME\]/$migration_name/g" \
        -e "s/\[TABLE_NAME\]/${TARGET_TABLE:-table_name}/g" \
        -e "s/\[TIME_ESTIMATE\]/5 minutes/g" \
        -e "s/\[TABLE_NAMES\]/${TARGET_TABLE:-table_name}/g" \
        -e "s/\[LIST_OF_DEPENDENT_MIGRATIONS\]/None/g" \
        -e "s/\[YES\/NO - with explanation\]/$(if [[ "$BREAKING_CHANGE" == "true" ]]; then echo "YES - This migration contains breaking changes"; else echo "NO - Non-breaking migration"; fi)/g" \
        -e "s/\[LOW\/MEDIUM\/HIGH - with details\]/MEDIUM - Standard migration performance impact/g" \
        "$output_file"

    # Remove backup file
    rm -f "${output_file}.bak"
}

# ============================================================================
# ROLLBACK GENERATION
# ============================================================================

generate_rollback_migration() {
    local timestamp="$1"
    local migration_name="${timestamp}_rollback_${MIGRATION_NAME}"
    local rollback_file="$MIGRATIONS_DIR/rollbacks/${migration_name}.sql"

    log_info "Generating rollback migration: $migration_name"

    # Use rollback template
    local rollback_template="$TEMPLATES_DIR/rollback-template.sql"
    customize_template "$rollback_template" "$rollback_file" "$timestamp"

    log_success "Rollback migration created: $rollback_file"
}

# ============================================================================
# TESTING FILE GENERATION
# ============================================================================

generate_test_file() {
    local timestamp="$1"
    local migration_name="${timestamp}_${MIGRATION_TYPE}_${MIGRATION_NAME}"
    local test_file="$MIGRATIONS_DIR/testing/test_${migration_name}.sql"

    log_info "Generating test file: test_${migration_name}.sql"

    cat > "$test_file" << EOF
-- 🧪 TEST FILE FOR MIGRATION: $migration_name
-- Description: Test cases for $MIGRATION_NAME migration
-- Author: $AUTHOR
-- Date: $(date -u '+%Y-%m-%d')

BEGIN;

-- ============================================================================
-- PRE-MIGRATION TESTS
-- ============================================================================

-- Test: Verify prerequisites
DO \$\$
BEGIN
    -- Add prerequisite validation tests here
    RAISE NOTICE 'Pre-migration tests: PASSED';
END \$\$;

-- ============================================================================
-- MIGRATION EXECUTION
-- ============================================================================

-- Execute the migration (this would be done via migration runner)
-- \i $(get_output_directory)/${migration_name}.sql

-- ============================================================================
-- POST-MIGRATION TESTS
-- ============================================================================

-- Test: Verify migration success
DO \$\$
BEGIN
    -- Add post-migration validation tests here
    RAISE NOTICE 'Post-migration tests: PASSED';
END \$\$;

-- ============================================================================
-- ROLLBACK TESTS
-- ============================================================================

-- Test: Verify rollback capability
DO \$\$
BEGIN
    -- Add rollback validation tests here
    RAISE NOTICE 'Rollback tests: PASSED';
END \$\$;

-- ============================================================================
-- PERFORMANCE TESTS
-- ============================================================================

-- Test: Check query performance impact
-- Add performance benchmarking queries here

ROLLBACK; -- Rollback test transaction

-- ============================================================================
-- TEST SUMMARY
-- ============================================================================

/*
Test Results for Migration: $migration_name

Test Categories:
- ✅ Pre-migration validation
- ✅ Migration execution
- ✅ Post-migration validation
- ✅ Rollback capability
- ✅ Performance impact

All tests should pass before deploying to production.
*/
EOF

    log_success "Test file created: $test_file"
}

# ============================================================================
# MAIN GENERATION LOGIC
# ============================================================================

main() {
    log_info "🗄️ Sovren Migration Generator - Elite Engineering"
    log_info "Generating $MIGRATION_TYPE migration: $MIGRATION_NAME"

    # Validate parameters
    validate_parameters

    # Generate timestamp
    local timestamp
    timestamp=$(generate_timestamp)

    # Determine file paths
    local migration_name="${timestamp}_${MIGRATION_TYPE}_${MIGRATION_NAME}"
    local output_dir
    output_dir=$(get_output_directory)
    local output_file="$output_dir/${migration_name}.sql"

    # Check if migration already exists
    if [[ -f "$output_file" ]]; then
        log_error "Migration file already exists: $output_file"
        exit 1
    fi

    # Get template file
    local template_file
    template_file=$(get_template_file)

    # Generate migration file
    log_info "Creating migration file: ${migration_name}.sql"
    customize_template "$template_file" "$output_file" "$timestamp"

    # Generate rollback migration (except for rollback migrations themselves)
    if [[ "$MIGRATION_TYPE" != "rollback" ]]; then
        generate_rollback_migration "$timestamp"
    fi

    # Generate test file
    generate_test_file "$timestamp"

    # Summary
    echo
    log_success "Migration generation completed successfully!"
    echo
    echo "📁 Files created:"
    echo "   • Migration: $output_file"
    if [[ "$MIGRATION_TYPE" != "rollback" ]]; then
        echo "   • Rollback:  $MIGRATIONS_DIR/rollbacks/${timestamp}_rollback_${MIGRATION_NAME}.sql"
    fi
    echo "   • Test:      $MIGRATIONS_DIR/testing/test_${migration_name}.sql"
    echo
    echo "📋 Next steps:"
    echo "   1. Edit the migration file to implement your changes"
    echo "   2. Update the test file with appropriate test cases"
    echo "   3. Validate the migration: ./validate.sh $output_file"
    echo "   4. Test in development environment"
    echo "   5. Create pull request for review"
    echo

    if [[ "$BREAKING_CHANGE" == "true" ]]; then
        log_warning "⚠️  This migration is marked as BREAKING CHANGE"
        log_warning "   Ensure proper coordination with the team before deployment"
    fi

    if [[ "$IS_HOTFIX" == "true" ]]; then
        log_warning "🚨 This is a HOTFIX migration"
        log_warning "   Follow emergency deployment procedures"
    fi
}

# ============================================================================
# EXECUTION
# ============================================================================

main "$@"
