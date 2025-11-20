#!/bin/bash

# ============================================================================
# HashiCorp Vault Quick Setup for Sovren Credential Rotation
# ============================================================================
#
# This script sets up HashiCorp Vault in Docker for development/testing
# Production deployment should use Vault in production mode with proper storage
#
# Usage: ./scripts/setup-vault.sh [dev|prod]
# ============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MODE="${1:-dev}"
VAULT_CONTAINER_NAME="sovren-vault"
VAULT_PORT="8200"
VAULT_VERSION="latest"
VAULT_DATA_DIR="$(pwd)/.vault-data"
VAULT_CONFIG_DIR="$(pwd)/.vault-config"

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Check Docker installation
check_docker() {
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
    fi
    log "Docker is installed ✅"
}

# Clean up existing Vault container
cleanup_existing() {
    if docker ps -a | grep -q "$VAULT_CONTAINER_NAME"; then
        warning "Existing Vault container found. Removing..."
        docker rm -f "$VAULT_CONTAINER_NAME" > /dev/null 2>&1
    fi
}

# Create necessary directories
create_directories() {
    log "Creating Vault directories..."
    mkdir -p "$VAULT_DATA_DIR"
    mkdir -p "$VAULT_CONFIG_DIR"
    chmod 700 "$VAULT_DATA_DIR"
    chmod 700 "$VAULT_CONFIG_DIR"
}

# Create Vault configuration for production mode
create_prod_config() {
    cat > "$VAULT_CONFIG_DIR/vault.hcl" << 'EOF'
ui = true

storage "file" {
  path = "/vault/file"
}

listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = 1
}

api_addr = "http://0.0.0.0:8200"
cluster_addr = "https://0.0.0.0:8201"

# Enable audit logging
audit {
  enabled = true
}

# Default lease durations
default_lease_ttl = "168h"
max_lease_ttl = "720h"
EOF
    log "Production configuration created"
}

# Start Vault in development mode
start_vault_dev() {
    log "Starting Vault in DEVELOPMENT mode..."

    docker run -d \
        --name "$VAULT_CONTAINER_NAME" \
        --cap-add=IPC_LOCK \
        -p "$VAULT_PORT:8200" \
        -e 'VAULT_DEV_ROOT_TOKEN_ID=root-token-sovren' \
        -e 'VAULT_DEV_LISTEN_ADDRESS=0.0.0.0:8200' \
        hashicorp/vault:${VAULT_VERSION}

    log "Vault started in dev mode on port $VAULT_PORT ✅"
    info "Dev Root Token: root-token-sovren"
    info "Vault Address: http://localhost:$VAULT_PORT"
}

# Start Vault in production mode
start_vault_prod() {
    log "Starting Vault in PRODUCTION mode..."

    create_prod_config

    docker run -d \
        --name "$VAULT_CONTAINER_NAME" \
        --cap-add=IPC_LOCK \
        -p "$VAULT_PORT:8200" \
        -v "$VAULT_CONFIG_DIR:/vault/config" \
        -v "$VAULT_DATA_DIR:/vault/file" \
        hashicorp/vault:${VAULT_VERSION} server

    log "Waiting for Vault to start..."
    sleep 5

    # Initialize Vault
    log "Initializing Vault..."
    INIT_OUTPUT=$(docker exec "$VAULT_CONTAINER_NAME" vault operator init -key-shares=1 -key-threshold=1 -format=json)

    # Extract keys
    UNSEAL_KEY=$(echo "$INIT_OUTPUT" | jq -r '.unseal_keys_b64[0]')
    ROOT_TOKEN=$(echo "$INIT_OUTPUT" | jq -r '.root_token')

    # Save keys securely
    echo "$INIT_OUTPUT" > "$VAULT_DATA_DIR/vault-init.json"
    chmod 600 "$VAULT_DATA_DIR/vault-init.json"

    # Unseal Vault
    log "Unsealing Vault..."
    docker exec "$VAULT_CONTAINER_NAME" vault operator unseal "$UNSEAL_KEY"

    log "Vault started in production mode ✅"
    info "Root Token: $ROOT_TOKEN"
    info "Unseal Key: $UNSEAL_KEY"
    info "Keys saved to: $VAULT_DATA_DIR/vault-init.json"
    warning "IMPORTANT: Back up these keys securely and delete from disk!"
}

# Configure Vault for credential rotation
configure_vault() {
    log "Configuring Vault for credential rotation..."

    local VAULT_TOKEN="${VAULT_TOKEN:-root-token-sovren}"
    if [ "$MODE" == "prod" ] && [ -f "$VAULT_DATA_DIR/vault-init.json" ]; then
        VAULT_TOKEN=$(jq -r '.root_token' "$VAULT_DATA_DIR/vault-init.json")
    fi

    # Wait for Vault to be ready
    sleep 3

    # Enable KV v2 secrets engine
    docker exec -e VAULT_TOKEN="$VAULT_TOKEN" "$VAULT_CONTAINER_NAME" \
        vault secrets enable -version=2 -path=sovren kv || true

    # Create policies for credential rotation
    cat > "$VAULT_CONFIG_DIR/rotation-policy.hcl" << 'EOF'
# Policy for credential rotation service
path "sovren/data/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

path "sovren/metadata/*" {
  capabilities = ["read", "list", "delete"]
}

path "sovren/delete/*" {
  capabilities = ["update"]
}

path "sovren/undelete/*" {
  capabilities = ["update"]
}

path "sovren/destroy/*" {
  capabilities = ["update"]
}

path "auth/token/create" {
  capabilities = ["create", "update"]
}

path "sys/policies/acl/*" {
  capabilities = ["read"]
}

# Enable audit log access
path "sys/audit" {
  capabilities = ["read", "list"]
}
EOF

    # Apply the policy
    docker cp "$VAULT_CONFIG_DIR/rotation-policy.hcl" "$VAULT_CONTAINER_NAME:/tmp/rotation-policy.hcl"
    docker exec -e VAULT_TOKEN="$VAULT_TOKEN" "$VAULT_CONTAINER_NAME" \
        vault policy write rotation-policy /tmp/rotation-policy.hcl

    log "Vault policies configured ✅"

    # Create initial secrets structure
    docker exec -e VAULT_TOKEN="$VAULT_TOKEN" "$VAULT_CONTAINER_NAME" \
        vault kv put sovren/github token="placeholder" || true

    docker exec -e VAULT_TOKEN="$VAULT_TOKEN" "$VAULT_CONTAINER_NAME" \
        vault kv put sovren/supabase password="placeholder" host="placeholder" || true

    log "Initial secret paths created ✅"

    # Enable audit logging
    docker exec -e VAULT_TOKEN="$VAULT_TOKEN" "$VAULT_CONTAINER_NAME" \
        vault audit enable file file_path=/vault/logs/audit.log || true

    log "Audit logging enabled ✅"
}

# Generate app token
generate_app_token() {
    log "Generating application token..."

    local VAULT_TOKEN="${VAULT_TOKEN:-root-token-sovren}"
    if [ "$MODE" == "prod" ] && [ -f "$VAULT_DATA_DIR/vault-init.json" ]; then
        VAULT_TOKEN=$(jq -r '.root_token' "$VAULT_DATA_DIR/vault-init.json")
    fi

    # Create a token with the rotation policy
    APP_TOKEN=$(docker exec -e VAULT_TOKEN="$VAULT_TOKEN" "$VAULT_CONTAINER_NAME" \
        vault token create -policy=rotation-policy -ttl=720h -format=json | jq -r '.auth.client_token')

    log "Application token generated ✅"
    info "App Token: $APP_TOKEN"

    # Save to .env file
    echo "" >> .env
    echo "# HashiCorp Vault Configuration" >> .env
    echo "VAULT_ADDR=http://localhost:$VAULT_PORT" >> .env
    echo "VAULT_TOKEN=$APP_TOKEN" >> .env
    echo "VAULT_NAMESPACE=" >> .env

    log "Vault configuration added to .env ✅"
}

# Test Vault connection
test_vault() {
    log "Testing Vault connection..."

    local VAULT_TOKEN="${VAULT_TOKEN:-root-token-sovren}"
    if [ "$MODE" == "prod" ] && [ -f "$VAULT_DATA_DIR/vault-init.json" ]; then
        VAULT_TOKEN=$(jq -r '.root_token' "$VAULT_DATA_DIR/vault-init.json")
    fi

    # Test status
    if docker exec "$VAULT_CONTAINER_NAME" vault status > /dev/null 2>&1; then
        log "Vault is running and accessible ✅"
    else
        error "Vault is not accessible"
    fi

    # Test write/read
    docker exec -e VAULT_TOKEN="$VAULT_TOKEN" "$VAULT_CONTAINER_NAME" \
        vault kv put sovren/test value="test-$(date +%s)"

    TEST_VALUE=$(docker exec -e VAULT_TOKEN="$VAULT_TOKEN" "$VAULT_CONTAINER_NAME" \
        vault kv get -format=json sovren/test | jq -r '.data.data.value')

    if [ -n "$TEST_VALUE" ]; then
        log "Write/Read test successful ✅"
        docker exec -e VAULT_TOKEN="$VAULT_TOKEN" "$VAULT_CONTAINER_NAME" \
            vault kv delete sovren/test > /dev/null 2>&1
    else
        error "Write/Read test failed"
    fi
}

# Print summary
print_summary() {
    echo ""
    echo "========================================="
    echo "   HashiCorp Vault Setup Complete 🎉"
    echo "========================================="
    echo ""
    echo "Vault is running in $MODE mode"
    echo ""
    echo "🔗 Web UI: http://localhost:$VAULT_PORT"
    echo ""

    if [ "$MODE" == "dev" ]; then
        echo "🔐 Dev Root Token: root-token-sovren"
    else
        if [ -f "$VAULT_DATA_DIR/vault-init.json" ]; then
            ROOT_TOKEN=$(jq -r '.root_token' "$VAULT_DATA_DIR/vault-init.json")
            echo "🔐 Root Token: $ROOT_TOKEN"
            echo "📁 Keys saved to: $VAULT_DATA_DIR/vault-init.json"
            echo ""
            warning "⚠️  IMPORTANT: Back up the init file and remove from disk!"
        fi
    fi

    echo ""
    echo "Environment variables have been added to .env"
    echo ""
    echo "Quick Commands:"
    echo "  Check status:  docker exec $VAULT_CONTAINER_NAME vault status"
    echo "  View logs:     docker logs $VAULT_CONTAINER_NAME"
    echo "  Stop Vault:    docker stop $VAULT_CONTAINER_NAME"
    echo "  Start Vault:   docker start $VAULT_CONTAINER_NAME"
    echo "  Remove Vault:  docker rm -f $VAULT_CONTAINER_NAME"
    echo ""
    echo "Next steps:"
    echo "  1. Run credential rotation scripts"
    echo "  2. Scripts will automatically use Vault for secrets"
    echo "  3. Monitor audit logs in Vault UI"
    echo ""
}

# Main execution
main() {
    echo ""
    echo "🔐 HashiCorp Vault Setup for Sovren"
    echo "===================================="
    echo "Mode: $MODE"
    echo ""

    check_docker
    cleanup_existing
    create_directories

    if [ "$MODE" == "prod" ]; then
        start_vault_prod
    else
        start_vault_dev
    fi

    configure_vault
    generate_app_token
    test_vault
    print_summary
}

# Run main function
main "$@"