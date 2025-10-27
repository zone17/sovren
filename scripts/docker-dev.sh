#!/bin/bash

# Sovren Docker Development Environment Manager
# Elite development workflow automation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Change to project root
cd "$PROJECT_ROOT"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
}

# Function to check if .env file exists
check_env() {
    if [ ! -f .env ]; then
        print_warning ".env file not found. Copying from env.example..."
        cp env.example .env
        print_warning "Please update .env file with your configuration before running the services."
        return 1
    fi
    return 0
}

# Function to build development images
build_dev() {
    print_status "Building development Docker images..."
    docker-compose build --no-cache
    print_success "Development images built successfully!"
}

# Function to start development environment
start_dev() {
    print_status "Starting Sovren development environment..."

    # Check prerequisites
    check_docker
    if ! check_env; then
        print_error "Please configure .env file before starting services."
        exit 1
    fi

    # Start services
    docker-compose up -d

    print_success "Development environment started!"
    print_status "Services available at:"
    echo "  - Frontend: http://localhost:5173"
    echo "  - Backend API: http://localhost:3001"
    echo "  - Nginx Proxy: http://localhost:8080"
    echo "  - Redis: localhost:6379"
    echo "  - PostgreSQL: localhost:5432"
    echo "  - Mailhog: http://localhost:8025"
    echo ""
    print_status "To view logs: ./scripts/docker-dev.sh logs"
    print_status "To stop services: ./scripts/docker-dev.sh stop"
}

# Function to stop development environment
stop_dev() {
    print_status "Stopping Sovren development environment..."
    docker-compose down
    print_success "Development environment stopped!"
}

# Function to restart development environment
restart_dev() {
    print_status "Restarting Sovren development environment..."
    docker-compose restart
    print_success "Development environment restarted!"
}

# Function to view logs
logs_dev() {
    if [ -n "$2" ]; then
        docker-compose logs -f "$2"
    else
        docker-compose logs -f
    fi
}

# Function to run commands in containers
exec_dev() {
    if [ -z "$2" ]; then
        print_error "Usage: $0 exec <service> [command]"
        exit 1
    fi

    service="$2"
    shift 2
    command="$*"

    if [ -z "$command" ]; then
        command="/bin/sh"
    fi

    docker-compose exec "$service" $command
}

# Function to clean up development environment
clean_dev() {
    print_status "Cleaning up Sovren development environment..."
    docker-compose down -v --remove-orphans
    docker system prune -f
    print_success "Development environment cleaned!"
}

# Function to show status
status_dev() {
    print_status "Sovren development environment status:"
    docker-compose ps
}

# Function to run tests
test_dev() {
    print_status "Running tests in development environment..."

    # Run backend tests
    print_status "Running backend tests..."
    docker-compose exec backend npm test

    # Run frontend tests
    print_status "Running frontend tests..."
    docker-compose exec frontend npm test

    print_success "All tests completed!"
}

# Function to show help
show_help() {
    echo "Sovren Docker Development Environment Manager"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  build     Build development Docker images"
    echo "  start     Start development environment"
    echo "  stop      Stop development environment"
    echo "  restart   Restart development environment"
    echo "  logs      View logs (optionally specify service)"
    echo "  exec      Execute command in container"
    echo "  clean     Clean up development environment"
    echo "  status    Show service status"
    echo "  test      Run tests in development environment"
    echo "  help      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 start                    # Start all services"
    echo "  $0 logs backend             # View backend logs"
    echo "  $0 exec backend npm test    # Run backend tests"
    echo "  $0 exec frontend /bin/sh    # Open shell in frontend container"
}

# Main command handling
case "${1:-help}" in
    build)
        build_dev
        ;;
    start)
        start_dev
        ;;
    stop)
        stop_dev
        ;;
    restart)
        restart_dev
        ;;
    logs)
        logs_dev "$@"
        ;;
    exec)
        exec_dev "$@"
        ;;
    clean)
        clean_dev
        ;;
    status)
        status_dev
        ;;
    test)
        test_dev
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
