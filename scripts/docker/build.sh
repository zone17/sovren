#!/bin/bash
# ========================================
# Sovren - Elite Docker Build Script
# ========================================
# Production-grade Docker build with:
# - BuildKit parallel builds
# - Multi-architecture support (amd64, arm64)
# - Layer caching optimization
# - SBOM and provenance generation
# - Automatic security scanning
# - Image size validation
# ========================================

set -euo pipefail

# ========================================
# Configuration
# ========================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
BACKEND_DIR="${PROJECT_ROOT}/packages/backend"

# Default values
IMAGE_NAME="${IMAGE_NAME:-sovren-backend}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
REGISTRY="${REGISTRY:-ghcr.io}"
GITHUB_OWNER="${GITHUB_OWNER:-sovren}"
PLATFORM="${PLATFORM:-linux/amd64}"
BUILD_MODE="${BUILD_MODE:-production}"
PUSH="${PUSH:-false}"
SCAN="${SCAN:-true}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ========================================
# Helper Functions
# ========================================
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
Usage: $0 [OPTIONS]

Elite Docker build script for Sovren backend

OPTIONS:
    -n, --name NAME         Image name (default: sovren-backend)
    -t, --tag TAG          Image tag (default: latest)
    -r, --registry REG     Container registry (default: ghcr.io)
    -o, --owner OWNER      GitHub owner (default: sovren)
    -p, --platform PLAT    Platform (default: linux/amd64)
                           Use 'multi' for linux/amd64,linux/arm64
    -m, --mode MODE        Build mode: production or development (default: production)
    --push                 Push to registry after build
    --no-scan              Skip security scanning
    -h, --help             Show this help message

EXAMPLES:
    # Build for current architecture
    $0 -n sovren-backend -t v1.0.0

    # Build multi-architecture and push
    $0 -t v1.0.0 -p multi --push

    # Development build
    $0 -m development -t dev

ENVIRONMENT VARIABLES:
    DOCKER_BUILDKIT=1      Enable BuildKit (recommended)
    IMAGE_NAME             Image name
    IMAGE_TAG              Image tag
    REGISTRY               Container registry
    GITHUB_OWNER           GitHub repository owner
    PLATFORM               Build platform
    BUILD_MODE             Build mode (production/development)

EOF
    exit 0
}

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -n|--name)
                IMAGE_NAME="$2"
                shift 2
                ;;
            -t|--tag)
                IMAGE_TAG="$2"
                shift 2
                ;;
            -r|--registry)
                REGISTRY="$2"
                shift 2
                ;;
            -o|--owner)
                GITHUB_OWNER="$2"
                shift 2
                ;;
            -p|--platform)
                if [[ "$2" == "multi" ]]; then
                    PLATFORM="linux/amd64,linux/arm64"
                else
                    PLATFORM="$2"
                fi
                shift 2
                ;;
            -m|--mode)
                BUILD_MODE="$2"
                shift 2
                ;;
            --push)
                PUSH="true"
                shift
                ;;
            --no-scan)
                SCAN="false"
                shift
                ;;
            -h|--help)
                show_usage
                ;;
            *)
                log_error "Unknown option: $1"
                show_usage
                ;;
        esac
    done
}

check_dependencies() {
    log_info "Checking dependencies..."

    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi

    # Check Docker Buildx
    if ! docker buildx version &> /dev/null; then
        log_error "Docker Buildx is not available"
        exit 1
    fi

    # Enable BuildKit
    export DOCKER_BUILDKIT=1
    export BUILDKIT_PROGRESS=plain

    log_success "All dependencies are available"
}

setup_buildx() {
    log_info "Setting up Docker Buildx..."

    # Create or use existing builder
    if ! docker buildx inspect sovren-builder &> /dev/null; then
        log_info "Creating new buildx builder: sovren-builder"
        docker buildx create \
            --name sovren-builder \
            --driver docker-container \
            --bootstrap \
            --use
    else
        log_info "Using existing buildx builder: sovren-builder"
        docker buildx use sovren-builder
    fi

    # Inspect builder
    docker buildx inspect --bootstrap

    log_success "Buildx setup complete"
}

build_image() {
    log_info "Building Docker image..."

    FULL_IMAGE_NAME="${REGISTRY}/${GITHUB_OWNER}/${IMAGE_NAME}:${IMAGE_TAG}"

    log_info "Image: ${FULL_IMAGE_NAME}"
    log_info "Platform: ${PLATFORM}"
    log_info "Build mode: ${BUILD_MODE}"

    # Build arguments
    BUILD_ARGS=(
        --build-arg BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
        --build-arg VCS_REF="$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
        --build-arg VERSION="${IMAGE_TAG}"
    )

    # BuildKit cache settings
    CACHE_ARGS=(
        --cache-from type=local,src=/tmp/.buildx-cache
        --cache-to type=local,dest=/tmp/.buildx-cache-new,mode=max
    )

    # Platform settings
    PLATFORM_ARGS=(
        --platform "${PLATFORM}"
    )

    # SBOM and provenance
    PROVENANCE_ARGS=(
        --sbom=true
        --provenance=true
    )

    # Build command
    BUILD_CMD="docker buildx build"

    # Add push flag if requested
    if [[ "${PUSH}" == "true" ]]; then
        BUILD_CMD="${BUILD_CMD} --push"
    else
        BUILD_CMD="${BUILD_CMD} --load"
    fi

    # Execute build
    ${BUILD_CMD} \
        "${BUILD_ARGS[@]}" \
        "${CACHE_ARGS[@]}" \
        "${PLATFORM_ARGS[@]}" \
        "${PROVENANCE_ARGS[@]}" \
        --tag "${FULL_IMAGE_NAME}" \
        --file "${BACKEND_DIR}/Dockerfile" \
        "${BACKEND_DIR}"

    # Rotate cache to prevent unlimited growth
    rm -rf /tmp/.buildx-cache
    mv /tmp/.buildx-cache-new /tmp/.buildx-cache || true

    log_success "Docker image built successfully"
}

validate_image() {
    log_info "Validating image..."

    FULL_IMAGE_NAME="${REGISTRY}/${GITHUB_OWNER}/${IMAGE_NAME}:${IMAGE_TAG}"

    # Check if image exists locally (skip if pushed)
    if [[ "${PUSH}" == "false" ]]; then
        if ! docker image inspect "${FULL_IMAGE_NAME}" &> /dev/null; then
            log_error "Image not found: ${FULL_IMAGE_NAME}"
            exit 1
        fi

        # Get image size
        SIZE=$(docker image inspect "${FULL_IMAGE_NAME}" --format='{{.Size}}')
        SIZE_MB=$((SIZE / 1024 / 1024))

        echo "Image size: ${SIZE_MB}MB"

        if [ $SIZE_MB -gt 150 ]; then
            log_warning "Image size ${SIZE_MB}MB exceeds 150MB target"
        else
            log_success "Image size validation passed: ${SIZE_MB}MB (target: <150MB)"
        fi

        # Show image details
        echo ""
        docker images "${FULL_IMAGE_NAME}"
        echo ""
    fi

    log_success "Image validation complete"
}

run_security_scan() {
    if [[ "${SCAN}" == "true" && "${PUSH}" == "false" ]]; then
        log_info "Running security scan..."

        FULL_IMAGE_NAME="${REGISTRY}/${GITHUB_OWNER}/${IMAGE_NAME}:${IMAGE_TAG}"

        if [[ -f "${SCRIPT_DIR}/security-scan.sh" ]]; then
            bash "${SCRIPT_DIR}/security-scan.sh" "${FULL_IMAGE_NAME}"
        else
            log_warning "Security scan script not found, skipping..."
        fi
    else
        log_info "Skipping security scan (SCAN=${SCAN}, PUSH=${PUSH})"
    fi
}

print_summary() {
    echo ""
    echo "========================================="
    echo "Build Summary"
    echo "========================================="
    echo "Image: ${REGISTRY}/${GITHUB_OWNER}/${IMAGE_NAME}:${IMAGE_TAG}"
    echo "Platform: ${PLATFORM}"
    echo "Build mode: ${BUILD_MODE}"
    echo "Pushed: ${PUSH}"
    echo "Scanned: ${SCAN}"
    echo ""

    if [[ "${PUSH}" == "false" ]]; then
        echo "To run the container:"
        echo "  docker run -p 3001:3001 ${REGISTRY}/${GITHUB_OWNER}/${IMAGE_NAME}:${IMAGE_TAG}"
        echo ""
        echo "To push the image:"
        echo "  docker push ${REGISTRY}/${GITHUB_OWNER}/${IMAGE_NAME}:${IMAGE_TAG}"
        echo ""
    fi

    echo "========================================="
    log_success "Build complete!"
    echo "========================================="
}

# ========================================
# Main Execution
# ========================================
main() {
    echo "========================================="
    echo "Sovren Elite Docker Builder"
    echo "========================================="
    echo ""

    parse_arguments "$@"
    check_dependencies
    setup_buildx

    echo ""
    build_image

    echo ""
    validate_image

    echo ""
    run_security_scan

    echo ""
    print_summary
}

# Run main function
main "$@"
