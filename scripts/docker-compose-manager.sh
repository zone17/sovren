#!/bin/bash

# Sovren Docker Compose Management Script
# Elite Engineering Standards for Container Orchestration

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.yml"
ENV_FILE="${PROJECT_ROOT}/docker-compose.env"

# Available profiles
PROFILES=(
    "minimal"
    "development"
    "testing"
    "production"
    "monitoring"
)

# Available services
SERVICES=(
    "backend"
    "frontend"
    "postgres"
    "redis"
    "nginx"
    "mcp-gateway"
    "prometheus"
    "grafana"
    "fluent-bit"
    "mailhog"
    "postgres-test"
    "redis-test"
)

# Function to display usage
usage() {
    echo -e "${WHITE}Sovren Docker Compose Management Script${NC}"
    echo -e "${WHITE}=====================================${NC}"
    echo ""
    echo -e "${CYAN}Usage: $0 <command> [options]${NC}"
    echo ""
    echo -e "${WHITE}Commands:${NC}"
    echo -e "  ${GREEN}start${NC}      <profile>       Start services with specific profile"
    echo -e "  ${GREEN}stop${NC}                       Stop all services"
    echo -e "  ${GREEN}restart${NC}    <profile>       Restart services with specific profile"
    echo -e "  ${GREEN}status${NC}                     Show service status"
    echo -e "  ${GREEN}logs${NC}       <service>       Show logs for specific service"
    echo -e "  ${GREEN}shell${NC}      <service>       Open shell in service container"
    echo -e "  ${GREEN}build${NC}      [service]       Build specific service or all services"
    echo -e "  ${GREEN}clean${NC}                      Clean up containers, volumes, and images"
    echo -e "  ${GREEN}reset${NC}                      Reset entire environment"
    echo -e "  ${GREEN}health${NC}                     Check health of all services"
    echo -e "  ${GREEN}backup${NC}                     Backup data volumes"
    echo -e "  ${GREEN}restore${NC}    <backup_file>   Restore from backup"
    echo -e "  ${GREEN}test${NC}                       Run test suite"
    echo -e "  ${GREEN}monitor${NC}                    Start monitoring stack"
    echo -e "  ${GREEN}validate${NC}                   Validate configuration"
    echo ""
    echo -e "${WHITE}Profiles:${NC}"
    echo -e "  ${BLUE}minimal${NC}        Database and cache only"
    echo -e "  ${BLUE}development${NC}    Full development environment"
    echo -e "  ${BLUE}testing${NC}        Testing environment with test databases"
    echo -e "  ${BLUE}production${NC}     Production-like environment"
    echo -e "  ${BLUE}monitoring${NC}     Monitoring and observability stack"
    echo ""
    echo -e "${WHITE}Examples:${NC}"
    echo -e "  $0 start development"
    echo -e "  $0 logs backend"
    echo -e "  $0 shell frontend"
    echo -e "  $0 build backend"
    echo -e "  $0 clean"
    echo ""
}

# Function to log messages
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

# Function to log success messages
log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Function to log error messages
log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to log warning messages
log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to check if profile is valid
is_valid_profile() {
    local profile="$1"
    for p in "${PROFILES[@]}"; do
        if [[ "$p" == "$profile" ]]; then
            return 0
        fi
    done
    return 1
}

# Function to check if service is valid
is_valid_service() {
    local service="$1"
    for s in "${SERVICES[@]}"; do
        if [[ "$s" == "$service" ]]; then
            return 0
        fi
    done
    return 1
}

# Function to ensure Docker is running
ensure_docker_running() {
    if ! docker info > /dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker first."
        exit 1
    fi
}

# Function to ensure environment file exists
ensure_env_file() {
    if [[ ! -f "$ENV_FILE" ]]; then
        log_warning "Environment file not found: $ENV_FILE"
        log "Creating default environment file..."
        cp "${PROJECT_ROOT}/docker-compose.env" "$ENV_FILE"
        log_success "Created environment file: $ENV_FILE"
        log_warning "Please update the environment variables in $ENV_FILE"
    fi
}

# Function to validate configuration
validate_config() {
    log "Validating Docker Compose configuration..."

    if ! docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" config > /dev/null 2>&1; then
        log_error "Docker Compose configuration is invalid"
        docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" config
        exit 1
    fi

    log_success "Docker Compose configuration is valid"
}

# Function to start services
start_services() {
    local profile="${1:-development}"

    if ! is_valid_profile "$profile"; then
        log_error "Invalid profile: $profile"
        echo "Available profiles: ${PROFILES[*]}"
        exit 1
    fi

    log "Starting Sovren services with profile: $profile"

    # Create necessary directories
    mkdir -p "${PROJECT_ROOT}/logs" "${PROJECT_ROOT}/volumes"

    # Start services with the specified profile
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" --profile "$profile" up -d

    log_success "Services started successfully"

    # Wait for services to be healthy
    log "Waiting for services to be healthy..."
    sleep 10

    # Show service status
    show_status
}

# Function to stop services
stop_services() {
    log "Stopping all Sovren services..."
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down
    log_success "All services stopped"
}

# Function to restart services
restart_services() {
    local profile="${1:-development}"

    log "Restarting Sovren services with profile: $profile"
    stop_services
    start_services "$profile"
}

# Function to show service status
show_status() {
    echo -e "${WHITE}Service Status:${NC}"
    echo -e "${WHITE}==============${NC}"
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
    echo ""

    # Show resource usage
    echo -e "${WHITE}Resource Usage:${NC}"
    echo -e "${WHITE}===============${NC}"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" \
        $(docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps -q 2>/dev/null)
}

# Function to show logs
show_logs() {
    local service="${1:-}"

    if [[ -z "$service" ]]; then
        log_error "Please specify a service name"
        echo "Available services: ${SERVICES[*]}"
        exit 1
    fi

    if ! is_valid_service "$service"; then
        log_error "Invalid service: $service"
        echo "Available services: ${SERVICES[*]}"
        exit 1
    fi

    log "Showing logs for service: $service"
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs -f "$service"
}

# Function to open shell in service
open_shell() {
    local service="${1:-}"

    if [[ -z "$service" ]]; then
        log_error "Please specify a service name"
        echo "Available services: ${SERVICES[*]}"
        exit 1
    fi

    if ! is_valid_service "$service"; then
        log_error "Invalid service: $service"
        echo "Available services: ${SERVICES[*]}"
        exit 1
    fi

    log "Opening shell in service: $service"
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec "$service" /bin/sh
}

# Function to build services
build_services() {
    local service="${1:-}"

    if [[ -n "$service" ]]; then
        if ! is_valid_service "$service"; then
            log_error "Invalid service: $service"
            echo "Available services: ${SERVICES[*]}"
            exit 1
        fi
        log "Building service: $service"
        docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build "$service"
    else
        log "Building all services..."
        docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build
    fi

    log_success "Build completed"
}

# Function to clean up
clean_up() {
    log "Cleaning up Docker resources..."

    # Stop and remove containers
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down -v --remove-orphans

    # Remove unused images
    docker image prune -f

    # Remove unused volumes
    docker volume prune -f

    # Remove unused networks
    docker network prune -f

    log_success "Cleanup completed"
}

# Function to reset environment
reset_environment() {
    log_warning "This will completely reset the environment. All data will be lost!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "Reset cancelled"
        exit 0
    fi

    log "Resetting environment..."

    # Stop all services
    stop_services

    # Remove all containers, volumes, and images
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down -v --rmi all --remove-orphans

    # Remove data directories
    rm -rf "${PROJECT_ROOT}/volumes"
    rm -rf "${PROJECT_ROOT}/logs"

    # Recreate directories
    mkdir -p "${PROJECT_ROOT}/volumes"
    mkdir -p "${PROJECT_ROOT}/logs"

    log_success "Environment reset completed"
}

# Function to check health
check_health() {
    log "Checking service health..."

    local healthy=0
    local total=0

    # Get list of running containers
    local containers=$(docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps -q 2>/dev/null)

    for container in $containers; do
        if [[ -n "$container" ]]; then
            total=$((total + 1))
            local name=$(docker inspect --format '{{.Name}}' "$container" | sed 's/\///')
            local health=$(docker inspect --format '{{.State.Health.Status}}' "$container" 2>/dev/null || echo "no-health-check")

            if [[ "$health" == "healthy" ]] || [[ "$health" == "no-health-check" ]]; then
                echo -e "${GREEN}✓${NC} $name: healthy"
                healthy=$((healthy + 1))
            else
                echo -e "${RED}✗${NC} $name: $health"
            fi
        fi
    done

    echo ""
    echo -e "${WHITE}Health Summary: $healthy/$total services healthy${NC}"

    if [[ $healthy -eq $total ]]; then
        log_success "All services are healthy"
    else
        log_warning "Some services are not healthy"
    fi
}

# Function to backup data
backup_data() {
    local backup_dir="${PROJECT_ROOT}/backups"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="${backup_dir}/sovren_backup_${timestamp}.tar.gz"

    log "Creating backup..."

    mkdir -p "$backup_dir"

    # Create backup of volumes
    tar -czf "$backup_file" -C "${PROJECT_ROOT}" volumes/

    log_success "Backup created: $backup_file"
}

# Function to restore data
restore_data() {
    local backup_file="${1:-}"

    if [[ -z "$backup_file" ]]; then
        log_error "Please specify a backup file"
        exit 1
    fi

    if [[ ! -f "$backup_file" ]]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi

    log_warning "This will overwrite existing data!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "Restore cancelled"
        exit 0
    fi

    log "Restoring from backup: $backup_file"

    # Stop services
    stop_services

    # Remove existing volumes
    rm -rf "${PROJECT_ROOT}/volumes"

    # Extract backup
    tar -xzf "$backup_file" -C "${PROJECT_ROOT}"

    log_success "Restore completed"
}

# Function to run tests
run_tests() {
    log "Running test suite..."

    # Start test environment
    start_services "testing"

    # Run backend tests
    log "Running backend tests..."
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec backend npm test

    # Run frontend tests
    log "Running frontend tests..."
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec frontend npm test

    log_success "Test suite completed"
}

# Function to start monitoring
start_monitoring() {
    log "Starting monitoring stack..."
    start_services "monitoring"

    echo ""
    echo -e "${WHITE}Monitoring URLs:${NC}"
    echo -e "${CYAN}Prometheus:${NC} http://localhost:9090"
    echo -e "${CYAN}Grafana:${NC} http://localhost:3000 (admin/admin123)"
    echo ""
}

# Main script logic
main() {
    # Change to project root
    cd "$PROJECT_ROOT"

    # Check if Docker is running
    ensure_docker_running

    # Ensure environment file exists
    ensure_env_file

    # Get command and options
    local command="${1:-}"
    local option="${2:-}"

    case "$command" in
        "start")
            validate_config
            start_services "$option"
            ;;
        "stop")
            stop_services
            ;;
        "restart")
            validate_config
            restart_services "$option"
            ;;
        "status")
            show_status
            ;;
        "logs")
            show_logs "$option"
            ;;
        "shell")
            open_shell "$option"
            ;;
        "build")
            build_services "$option"
            ;;
        "clean")
            clean_up
            ;;
        "reset")
            reset_environment
            ;;
        "health")
            check_health
            ;;
        "backup")
            backup_data
            ;;
        "restore")
            restore_data "$option"
            ;;
        "test")
            run_tests
            ;;
        "monitor")
            start_monitoring
            ;;
        "validate")
            validate_config
            ;;
        "help"|"-h"|"--help")
            usage
            ;;
        *)
            log_error "Unknown command: $command"
            usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
