#!/bin/bash

# Sovren MCP Integration Setup Script
# Automates the secure deployment of MCP tools with Docker

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
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

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi

    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running. Please start Docker first."
        exit 1
    fi

    log_success "Prerequisites check passed"
}

# Generate secure secrets
generate_secrets() {
    log_info "Generating secure secrets..."

    # Create secrets directory
    mkdir -p .docker/secrets

    # Generate JWT secret
    openssl rand -base64 32 > .docker/secrets/jwt_secret

    # Generate admin password
    openssl rand -base64 16 > .docker/secrets/admin_password

    # Set secure permissions
    chmod 600 .docker/secrets/*

    log_success "Secrets generated and secured"
}

# Create Docker secrets
create_docker_secrets() {
    log_info "Creating Docker secrets..."

    # Remove existing secrets (if any)
    docker secret rm sovren_mcp_jwt_secret 2>/dev/null || true
    docker secret rm sovren_github_token 2>/dev/null || true
    docker secret rm sovren_supabase_url 2>/dev/null || true
    docker secret rm sovren_supabase_key 2>/dev/null || true

    # Create new secrets
    docker secret create sovren_mcp_jwt_secret .docker/secrets/jwt_secret

    # Prompt for GitHub token
    echo -n "Enter GitHub Personal Access Token (or press Enter to skip): "
    read -s github_token
    echo

    if [ ! -z "$github_token" ]; then
        echo "$github_token" | docker secret create sovren_github_token -
    else
        log_warning "GitHub token not provided. GitHub integration will be disabled."
        echo "placeholder" | docker secret create sovren_github_token -
    fi

    # Prompt for Supabase credentials
    echo -n "Enter Supabase URL (or press Enter to use local PostgreSQL): "
    read supabase_url

    if [ ! -z "$supabase_url" ]; then
        echo "$supabase_url" | docker secret create sovren_supabase_url -

        echo -n "Enter Supabase API Key: "
        read -s supabase_key
        echo
        echo "$supabase_key" | docker secret create sovren_supabase_key -
    else
        log_warning "Supabase credentials not provided. Using local PostgreSQL."
        echo "postgresql://localhost:5432/sovren" | docker secret create sovren_supabase_url -
        echo "placeholder" | docker secret create sovren_supabase_key -
    fi

    log_success "Docker secrets created"
}

# Build custom images
build_images() {
    log_info "Building MCP Gateway image..."

    cd docker/mcp-gateway
    npm install
    cd ../..

    docker build -t sovren/mcp-gateway:latest docker/mcp-gateway/

    log_success "Images built successfully"
}

# Initialize MCP services
start_services() {
    log_info "Starting MCP services..."

    # Start MCP stack
    docker-compose -f docker-compose.mcp.yml up -d

    # Wait for services to be healthy
    log_info "Waiting for services to be ready..."
    sleep 30

    # Check service health
    for service in mcp-gateway mcp-github mcp-postgres mcp-filesystem mcp-memory; do
        if docker-compose -f docker-compose.mcp.yml ps $service | grep -q "Up (healthy)"; then
            log_success "$service is healthy"
        else
            log_warning "$service may not be fully ready yet"
        fi
    done

    log_success "MCP services started"
}

# Create test authentication token
create_test_token() {
    log_info "Creating test authentication token..."

    admin_password=$(cat .docker/secrets/admin_password)

    # Wait for gateway to be ready
    sleep 10

    token_response=$(curl -s -X POST http://localhost:3000/auth/token \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"admin\",\"password\":\"$admin_password\"}" \
        || echo '{"error":"failed"}')

    if echo "$token_response" | grep -q '"token"'; then
        token=$(echo "$token_response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
        echo "$token" > .docker/secrets/test_token
        log_success "Test token created and saved to .docker/secrets/test_token"
        log_info "Use this token for API requests: Bearer $token"
    else
        log_error "Failed to create test token. Check gateway logs."
    fi
}

# Run security audit
security_audit() {
    log_info "Running security audit..."

    # Check container security
    docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
        aquasec/trivy image sovren/mcp-gateway:latest || log_warning "Security scan completed with findings"

    # Check for exposed ports
    exposed_ports=$(docker-compose -f docker-compose.mcp.yml ps --format "table {{.Names}}\t{{.Ports}}" | grep "0.0.0.0")
    if [ ! -z "$exposed_ports" ]; then
        log_warning "Exposed ports detected:"
        echo "$exposed_ports"
    fi

    log_success "Security audit completed"
}

# Display status and next steps
show_status() {
    echo
    log_success "MCP Integration Setup Complete!"
    echo
    echo "Services running:"
    docker-compose -f docker-compose.mcp.yml ps
    echo
    echo "Access points:"
    echo "  • MCP Gateway: http://localhost:3000"
    echo "  • Prometheus: http://localhost:9090"
    echo "  • Gateway Health: http://localhost:3000/health"
    echo
    echo "Authentication:"
    echo "  • Admin Password: $(cat .docker/secrets/admin_password)"
    echo "  • Test Token: $(cat .docker/secrets/test_token 2>/dev/null || echo 'Not created')"
    echo
    echo "Next steps:"
    echo "  1. Review security configurations in docker-compose.mcp.yml"
    echo "  2. Configure AI clients to use MCP endpoints"
    echo "  3. Monitor services via Prometheus dashboard"
    echo "  4. Check audit logs in Docker volumes"
    echo
    echo "Documentation: docs/mcp-integration-plan.md"
}

# Main execution
main() {
    echo
    log_info "Starting Sovren MCP Integration Setup"
    echo

    check_prerequisites
    generate_secrets
    create_docker_secrets
    build_images
    start_services
    create_test_token
    security_audit
    show_status

    echo
    log_success "Setup completed successfully!"
}

# Handle interruption
trap 'log_error "Setup interrupted by user"; exit 1' INT

# Run main function
main "$@"
