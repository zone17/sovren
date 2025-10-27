#!/bin/bash

###############################################################################
# Sovren Deployment Secrets Validation Script
#
# Purpose: Validates all required secrets are present and correctly formatted
# Usage: ./scripts/validate-deployment-secrets.sh [environment]
# Environment: production (default), staging, development
#
# Epic: 006 - Automated Deployment Pipeline
# User Story: US-E6-006
###############################################################################

set -e  # Exit on error
set -u  # Exit on undefined variable

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TOTAL_SECRETS=0
MISSING_SECRETS=0
INVALID_SECRETS=0
VALID_SECRETS=0

# Missing secrets list
MISSING_LIST=()

# Environment (default: production)
ENVIRONMENT="${1:-production}"

###############################################################################
# Helper Functions
###############################################################################

print_header() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  🔐 Sovren Secrets Validation${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "Environment: ${BLUE}${ENVIRONMENT^^}${NC}"
    echo -e "Date: $(date -u +'%Y-%m-%d %H:%M:%S UTC')"
    echo ""
}

print_section() {
    echo ""
    echo -e "${BLUE}▶ $1${NC}"
    echo -e "${BLUE}─────────────────────────────────────────────────${NC}"
}

check_secret() {
    local secret_name=$1
    local secret_value="${!secret_name:-}"
    local min_length=${2:-1}
    local pattern=${3:-}

    TOTAL_SECRETS=$((TOTAL_SECRETS + 1))

    # Check if secret exists
    if [ -z "$secret_value" ]; then
        echo -e "  ${RED}❌ $secret_name${NC} - Missing"
        MISSING_SECRETS=$((MISSING_SECRETS + 1))
        MISSING_LIST+=("$secret_name")
        return 1
    fi

    # Check minimum length
    local length=${#secret_value}
    if [ "$length" -lt "$min_length" ]; then
        echo -e "  ${YELLOW}⚠️  $secret_name${NC} - Too short ($length chars, minimum $min_length)"
        INVALID_SECRETS=$((INVALID_SECRETS + 1))
        return 1
    fi

    # Check pattern if provided
    if [ -n "$pattern" ]; then
        if [[ ! "$secret_value" =~ $pattern ]]; then
            echo -e "  ${YELLOW}⚠️  $secret_name${NC} - Invalid format"
            INVALID_SECRETS=$((INVALID_SECRETS + 1))
            return 1
        fi
    fi

    echo -e "  ${GREEN}✅ $secret_name${NC} - Valid ($length chars)"
    VALID_SECRETS=$((VALID_SECRETS + 1))
    return 0
}

check_optional_secret() {
    local secret_name=$1
    local secret_value="${!secret_name:-}"

    if [ -z "$secret_value" ]; then
        echo -e "  ${BLUE}ℹ️  $secret_name${NC} - Optional (not set)"
        return 0
    fi

    check_secret "$@"
}

###############################################################################
# Validation Functions
###############################################################################

validate_infrastructure_secrets() {
    print_section "Infrastructure & Deployment"

    check_secret "VERCEL_TOKEN" 20
    check_secret "VERCEL_ORG_ID" 10
    check_secret "VERCEL_PROJECT_ID" 10

    # GHCR_TOKEN is optional if using GITHUB_TOKEN
    check_optional_secret "GHCR_TOKEN" 20

    # Docker Hub (backup registry)
    check_optional_secret "DOCKER_USERNAME" 3
    check_optional_secret "DOCKER_PASSWORD" 20
}

validate_database_secrets() {
    print_section "Database & Caching"

    # Database URL
    check_secret "DATABASE_URL" 20 '^postgresql://'

    # Supabase
    check_secret "SUPABASE_URL" 20 '^https://.*\.supabase\.co$'
    check_secret "SUPABASE_ANON_KEY" 50 '^eyJ'
    check_secret "SUPABASE_SERVICE_ROLE_KEY" 50 '^eyJ'

    # Redis
    check_secret "REDIS_URL" 10 '^redis(s)?://'
}

validate_auth_secrets() {
    print_section "Authentication & Security"

    # JWT and Session secrets (minimum 64 chars for production)
    local min_length=32
    if [ "$ENVIRONMENT" = "production" ]; then
        min_length=64
    fi

    check_secret "JWT_SECRET" "$min_length"
    check_secret "SESSION_SECRET" "$min_length"

    # Encryption key (exactly 64 hex chars = 32 bytes)
    if [ -n "${ENCRYPTION_KEY:-}" ]; then
        local enc_length=${#ENCRYPTION_KEY}
        if [ "$enc_length" -eq 64 ]; then
            echo -e "  ${GREEN}✅ ENCRYPTION_KEY${NC} - Valid (64 chars)"
            VALID_SECRETS=$((VALID_SECRETS + 1))
        else
            echo -e "  ${YELLOW}⚠️  ENCRYPTION_KEY${NC} - Invalid length ($enc_length, must be 64)"
            INVALID_SECRETS=$((INVALID_SECRETS + 1))
        fi
        TOTAL_SECRETS=$((TOTAL_SECRETS + 1))
    else
        echo -e "  ${YELLOW}⚠️  ENCRYPTION_KEY${NC} - Missing"
        MISSING_SECRETS=$((MISSING_SECRETS + 1))
        MISSING_LIST+=("ENCRYPTION_KEY")
        TOTAL_SECRETS=$((TOTAL_SECRETS + 1))
    fi

    # Cosign password (for image signing)
    check_optional_secret "COSIGN_PASSWORD" 20
}

validate_external_services() {
    print_section "External Services"

    # Slack
    check_secret "SLACK_WEBHOOK_URL" 50 '^https://hooks\.slack\.com/'

    # Sentry
    check_secret "SENTRY_DSN" 30 '^https://.*@.*\.ingest\.sentry\.io/'

    # AI Services (optional)
    check_optional_secret "OPENAI_API_KEY" 20 '^sk-'
    check_optional_secret "ANTHROPIC_API_KEY" 20 '^sk-ant-'
}

validate_nostr_lightning() {
    print_section "NOSTR & Lightning Network"

    # NOSTR (optional for private relays)
    check_optional_secret "NOSTR_RELAY_SECRET" 10

    # Lightning Network
    check_optional_secret "LIGHTNING_NODE_MACAROON" 50
    check_optional_secret "LIGHTNING_NODE_TLS_CERT" 50
    check_optional_secret "LIGHTNING_NODE_URL" 10 '^https?://'
}

validate_staging_secrets() {
    print_section "Staging Environment Secrets"

    # Only validate staging secrets if in staging environment
    if [ "$ENVIRONMENT" != "staging" ]; then
        echo -e "  ${BLUE}ℹ️  Skipping staging secrets (not in staging environment)${NC}"
        return 0
    fi

    # Required staging secrets (with _STAGING suffix)
    check_secret "VERCEL_TOKEN_STAGING" 20
    check_secret "DATABASE_URL_STAGING" 20 '^postgresql://'
    check_secret "SUPABASE_URL_STAGING" 20 '^https://.*\.supabase\.co$'
    check_secret "SUPABASE_ANON_KEY_STAGING" 50 '^eyJ'
    check_secret "SUPABASE_SERVICE_ROLE_KEY_STAGING" 50 '^eyJ'
    check_secret "REDIS_URL_STAGING" 10 '^redis(s)?://'
    check_secret "JWT_SECRET_STAGING" 32
    check_secret "SESSION_SECRET_STAGING" 32

    # Optional staging secrets
    check_optional_secret "SLACK_WEBHOOK_URL_STAGING" 50
    check_optional_secret "SENTRY_DSN_STAGING" 30
    check_optional_secret "LIGHTNING_NODE_MACAROON_STAGING" 50
    check_optional_secret "LIGHTNING_NODE_URL_STAGING" 10
}

security_checks() {
    print_section "Security Validation"

    # Check for insecure default values
    local insecure_patterns=("secret" "password" "changeme" "default" "test123" "admin" "12345")
    local insecure_found=0

    for secret_name in JWT_SECRET SESSION_SECRET; do
        local secret_value="${!secret_name:-}"

        if [ -n "$secret_value" ]; then
            for pattern in "${insecure_patterns[@]}"; do
                if [[ "${secret_value,,}" == *"$pattern"* ]]; then
                    echo -e "  ${RED}❌ $secret_name contains insecure pattern: $pattern${NC}"
                    insecure_found=1
                fi
            done
        fi
    done

    if [ $insecure_found -eq 0 ]; then
        echo -e "  ${GREEN}✅ No insecure default patterns detected${NC}"
    else
        echo -e "  ${RED}❌ Insecure secrets detected - rotate immediately!${NC}"
        INVALID_SECRETS=$((INVALID_SECRETS + 1))
    fi

    # Check TLS usage
    if [ -n "${REDIS_URL:-}" ]; then
        if [[ "$REDIS_URL" =~ ^rediss:// ]]; then
            echo -e "  ${GREEN}✅ Redis using TLS (rediss://)${NC}"
        else
            echo -e "  ${YELLOW}⚠️  Redis not using TLS (consider rediss://)${NC}"
        fi
    fi

    if [ -n "${DATABASE_URL:-}" ]; then
        if [[ "$DATABASE_URL" =~ sslmode=require ]]; then
            echo -e "  ${GREEN}✅ Database requires SSL${NC}"
        else
            echo -e "  ${YELLOW}⚠️  Database SSL not required (add ?sslmode=require)${NC}"
        fi
    fi
}

print_summary() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  📊 Validation Summary${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "Total Secrets Checked:  ${BLUE}$TOTAL_SECRETS${NC}"
    echo -e "Valid Secrets:          ${GREEN}$VALID_SECRETS${NC}"
    echo -e "Missing Secrets:        ${RED}$MISSING_SECRETS${NC}"
    echo -e "Invalid Secrets:        ${YELLOW}$INVALID_SECRETS${NC}"
    echo ""

    # List missing secrets
    if [ ${#MISSING_LIST[@]} -gt 0 ]; then
        echo -e "${RED}Missing Secrets:${NC}"
        for secret in "${MISSING_LIST[@]}"; do
            echo -e "  - $secret"
        done
        echo ""
    fi

    # Final result
    if [ $MISSING_SECRETS -eq 0 ] && [ $INVALID_SECRETS -eq 0 ]; then
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${GREEN}  ✅ All secrets validated successfully!${NC}"
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
        return 0
    else
        echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${RED}  ❌ Secrets validation FAILED${NC}"
        echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
        echo -e "Action Required:"
        echo -e "1. Review missing/invalid secrets above"
        echo -e "2. Update secrets in GitHub Secrets or Vercel"
        echo -e "3. Refer to: ${BLUE}docs/deployment/secrets-setup-guide.md${NC}"
        echo ""
        return 1
    fi
}

generate_report() {
    local report_file="secrets-validation-report.txt"

    cat > "$report_file" << EOF
### Validation Details

**Total Secrets**: $TOTAL_SECRETS
**Valid**: $VALID_SECRETS
**Missing**: $MISSING_SECRETS
**Invalid**: $INVALID_SECRETS

EOF

    if [ ${#MISSING_LIST[@]} -gt 0 ]; then
        echo "**Missing Secrets**:" >> "$report_file"
        for secret in "${MISSING_LIST[@]}"; do
            echo "- \`$secret\`" >> "$report_file"
        done
        echo "" >> "$report_file"
    fi

    if [ $MISSING_SECRETS -eq 0 ] && [ $INVALID_SECRETS -eq 0 ]; then
        echo "**Status**: ✅ All secrets validated successfully" >> "$report_file"
    else
        echo "**Status**: ❌ Validation failed - action required" >> "$report_file"
    fi

    echo ""
    echo -e "${BLUE}📄 Report saved to: $report_file${NC}"
}

###############################################################################
# Main Execution
###############################################################################

main() {
    print_header

    # Run validation based on environment
    case "$ENVIRONMENT" in
        production)
            validate_infrastructure_secrets
            validate_database_secrets
            validate_auth_secrets
            validate_external_services
            validate_nostr_lightning
            security_checks
            ;;
        staging)
            validate_infrastructure_secrets
            validate_database_secrets
            validate_auth_secrets
            validate_external_services
            validate_nostr_lightning
            validate_staging_secrets
            security_checks
            ;;
        development)
            # Development has minimal requirements
            print_section "Development Environment"
            echo -e "  ${BLUE}ℹ️  Development secrets validated in local .env file${NC}"
            echo -e "  ${BLUE}ℹ️  Run: npm run validate:env for local validation${NC}"
            ;;
        *)
            echo -e "${RED}Error: Invalid environment '$ENVIRONMENT'${NC}"
            echo "Usage: $0 [production|staging|development]"
            exit 1
            ;;
    esac

    # Generate report (for CI/CD)
    if [ "${CI:-false}" = "true" ]; then
        generate_report
    fi

    # Print summary and exit with appropriate code
    if print_summary; then
        exit 0
    else
        exit 1
    fi
}

# Run main function
main
