#!/bin/bash

# Container Versioning Strategy for Sovren Production Images
# Implements semantic versioning, automated tagging, and registry management
# Following elite DevOps practices and container lifecycle management

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Registry configuration
REGISTRY=${CONTAINER_REGISTRY:-"ghcr.io/sovren"}
IMAGES=("backend" "frontend")

# Version file location
VERSION_FILE="${PROJECT_ROOT}/VERSION"

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# Get current version
get_current_version() {
    if [[ -f "${VERSION_FILE}" ]]; then
        cat "${VERSION_FILE}"
    else
        echo "0.0.0"
    fi
}

# Set new version
set_version() {
    local version=$1
    echo "${version}" > "${VERSION_FILE}"
    log "Version set to ${version}"
}

# Validate semantic version format
validate_version() {
    local version=$1
    if [[ ! "${version}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        error "Invalid version format: ${version}. Must be semantic version (x.y.z)"
        return 1
    fi
    return 0
}

# Get next version based on bump type
get_next_version() {
    local current_version=$1
    local bump_type=$2

    IFS='.' read -ra VERSION_PARTS <<< "${current_version}"
    local major=${VERSION_PARTS[0]}
    local minor=${VERSION_PARTS[1]}
    local patch=${VERSION_PARTS[2]}

    case "${bump_type}" in
        "major")
            ((major++))
            minor=0
            patch=0
            ;;
        "minor")
            ((minor++))
            patch=0
            ;;
        "patch")
            ((patch++))
            ;;
        *)
            error "Invalid bump type: ${bump_type}. Must be major, minor, or patch"
            return 1
            ;;
    esac

    echo "${major}.${minor}.${patch}"
}

# Get Git information for tagging
get_git_info() {
    local git_commit=""
    local git_branch=""
    local git_tag=""

    if git rev-parse --git-dir > /dev/null 2>&1; then
        git_commit=$(git rev-parse --short HEAD)
        git_branch=$(git rev-parse --abbrev-ref HEAD)
        git_tag=$(git describe --tags --exact-match 2>/dev/null || echo "")
    fi

    echo "${git_commit},${git_branch},${git_tag}"
}

# Generate comprehensive image tags
generate_image_tags() {
    local version=$1
    local image_name=$2
    local git_info=$3

    IFS=',' read -ra GIT_PARTS <<< "${git_info}"
    local git_commit=${GIT_PARTS[0]}
    local git_branch=${GIT_PARTS[1]}
    local git_tag=${GIT_PARTS[2]}

    local base_image="${REGISTRY}/${image_name}"
    local tags=()

    # Version-based tags
    tags+=("${base_image}:${version}")
    tags+=("${base_image}:v${version}")

    # Git-based tags
    if [[ -n "${git_commit}" ]]; then
        tags+=("${base_image}:${git_commit}")
        tags+=("${base_image}:${version}-${git_commit}")
    fi

    # Branch-based tags
    if [[ -n "${git_branch}" && "${git_branch}" != "HEAD" ]]; then
        # Sanitize branch name for tag
        local sanitized_branch=$(echo "${git_branch}" | sed 's/[^a-zA-Z0-9._-]/-/g')
        tags+=("${base_image}:${sanitized_branch}")

        # Latest tag for main/master branch
        if [[ "${git_branch}" == "main" || "${git_branch}" == "master" ]]; then
            tags+=("${base_image}:latest")
        fi
    fi

    # Date-based tag
    local date_tag=$(date +"%Y%m%d")
    tags+=("${base_image}:${date_tag}")

    # Build timestamp tag
    local timestamp=$(date +"%Y%m%d%H%M%S")
    tags+=("${base_image}:build-${timestamp}")

    printf '%s\n' "${tags[@]}"
}

# Build container image with comprehensive metadata
build_image() {
    local image_name=$1
    local version=$2
    local dockerfile=$3
    local context_dir=$4

    log "Building ${image_name} version ${version}..."

    local git_info=$(get_git_info)
    IFS=',' read -ra GIT_PARTS <<< "${git_info}"
    local git_commit=${GIT_PARTS[0]}
    local git_branch=${GIT_PARTS[1]}

    local build_date=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local base_image="${REGISTRY}/${image_name}:${version}"

    # Build with comprehensive labels
    docker build \
        --file "${dockerfile}" \
        --tag "${base_image}" \
        --label "org.opencontainers.image.created=${build_date}" \
        --label "org.opencontainers.image.version=${version}" \
        --label "org.opencontainers.image.revision=${git_commit}" \
        --label "org.opencontainers.image.source=https://github.com/sovren/sovren" \
        --label "org.opencontainers.image.title=Sovren ${image_name^}" \
        --label "org.opencontainers.image.description=Elite ${image_name} service for Sovren platform" \
        --label "org.opencontainers.image.vendor=Sovren" \
        --label "org.opencontainers.image.licenses=MIT" \
        --label "sovren.build.branch=${git_branch}" \
        --label "sovren.build.environment=production" \
        --build-arg BUILD_DATE="${build_date}" \
        --build-arg GIT_COMMIT="${git_commit}" \
        --build-arg VERSION="${version}" \
        "${context_dir}"

    if [[ $? -eq 0 ]]; then
        success "Successfully built ${image_name}:${version}"
        return 0
    else
        error "Failed to build ${image_name}:${version}"
        return 1
    fi
}

# Tag image with all generated tags
tag_image() {
    local image_name=$1
    local version=$2

    local git_info=$(get_git_info)
    local base_image="${REGISTRY}/${image_name}:${version}"

    log "Tagging ${image_name} with all variants..."

    # Generate all tags
    local tags
    readarray -t tags < <(generate_image_tags "${version}" "${image_name}" "${git_info}")

    # Apply all tags
    for tag in "${tags[@]}"; do
        if [[ "${tag}" != "${base_image}" ]]; then
            docker tag "${base_image}" "${tag}"
            log "Tagged: ${tag}"
        fi
    done

    success "Applied ${#tags[@]} tags to ${image_name}"
}

# Push image to registry
push_image() {
    local image_name=$1
    local version=$2
    local push_all=${3:-false}

    log "Pushing ${image_name} to registry..."

    if [[ "${push_all}" == "true" ]]; then
        # Push all tags
        local git_info=$(get_git_info)
        local tags
        readarray -t tags < <(generate_image_tags "${version}" "${image_name}" "${git_info}")

        for tag in "${tags[@]}"; do
            log "Pushing ${tag}..."
            if docker push "${tag}"; then
                success "Pushed ${tag}"
            else
                error "Failed to push ${tag}"
                return 1
            fi
        done
    else
        # Push only main version tag
        local main_tag="${REGISTRY}/${image_name}:${version}"
        if docker push "${main_tag}"; then
            success "Pushed ${main_tag}"
        else
            error "Failed to push ${main_tag}"
            return 1
        fi
    fi
}

# Scan image for vulnerabilities before push
scan_before_push() {
    local image_name=$1
    local version=$2

    log "Scanning ${image_name}:${version} for vulnerabilities..."

    local full_image="${REGISTRY}/${image_name}:${version}"

    # Run Trivy scan if available
    if command -v trivy &> /dev/null; then
        if trivy image --exit-code 1 --severity HIGH,CRITICAL "${full_image}"; then
            success "Image passed security scan"
            return 0
        else
            error "Image failed security scan - blocking push"
            return 1
        fi
    else
        warning "Trivy not available - skipping security scan"
        return 0
    fi
}

# Clean up old images
cleanup_old_images() {
    local keep_count=${1:-10}

    log "Cleaning up old container images (keeping ${keep_count} most recent)..."

    for image_name in "${IMAGES[@]}"; do
        local base_image="${REGISTRY}/${image_name}"

        # Get all tags for this image, sorted by creation date
        local old_images
        readarray -t old_images < <(docker images "${base_image}" --format "table {{.Repository}}:{{.Tag}}\t{{.CreatedAt}}" | \
            grep -v "REPOSITORY" | \
            sort -k2 -r | \
            tail -n +$((keep_count + 1)) | \
            awk '{print $1}')

        if [[ ${#old_images[@]} -gt 0 ]]; then
            log "Removing ${#old_images[@]} old images for ${image_name}..."
            for old_image in "${old_images[@]}"; do
                docker rmi "${old_image}" 2>/dev/null || true
            done
            success "Cleaned up old images for ${image_name}"
        else
            log "No old images to clean up for ${image_name}"
        fi
    done
}

# Generate build manifest
generate_build_manifest() {
    local version=$1
    local manifest_file="${PROJECT_ROOT}/build-manifest-${version}.json"

    log "Generating build manifest..."

    local git_info=$(get_git_info)
    IFS=',' read -ra GIT_PARTS <<< "${git_info}"
    local git_commit=${GIT_PARTS[0]}
    local git_branch=${GIT_PARTS[1]}

    cat > "${manifest_file}" << EOF
{
  "version": "${version}",
  "buildDate": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "git": {
    "commit": "${git_commit}",
    "branch": "${git_branch}"
  },
  "images": [
EOF

    local first=true
    for image_name in "${IMAGES[@]}"; do
        if [[ "${first}" == "false" ]]; then
            echo "," >> "${manifest_file}"
        fi
        first=false

        cat >> "${manifest_file}" << EOF
    {
      "name": "${image_name}",
      "registry": "${REGISTRY}",
      "tags": [
EOF

        local tags
        readarray -t tags < <(generate_image_tags "${version}" "${image_name}" "${git_info}")

        local tag_first=true
        for tag in "${tags[@]}"; do
            if [[ "${tag_first}" == "false" ]]; then
                echo "," >> "${manifest_file}"
            fi
            tag_first=false
            echo "        \"${tag}\"" >> "${manifest_file}"
        done

        echo "      ]" >> "${manifest_file}"
        echo -n "    }" >> "${manifest_file}"
    done

    cat >> "${manifest_file}" << EOF

  ]
}
EOF

    success "Build manifest generated: ${manifest_file}"
}

# Main operations
case "${1:-help}" in
    "build")
        version=${2:-$(get_current_version)}
        validate_version "${version}"

        for image_name in "${IMAGES[@]}"; do
            dockerfile="${PROJECT_ROOT}/packages/${image_name}/Dockerfile.prod"
            context_dir="${PROJECT_ROOT}/packages/${image_name}"

            if [[ -f "${dockerfile}" ]]; then
                build_image "${image_name}" "${version}" "${dockerfile}" "${context_dir}"
                tag_image "${image_name}" "${version}"
            else
                error "Dockerfile not found: ${dockerfile}"
                exit 1
            fi
        done

        generate_build_manifest "${version}"
        success "All images built successfully for version ${version}"
        ;;

    "push")
        version=${2:-$(get_current_version)}
        push_all=${3:-false}

        for image_name in "${IMAGES[@]}"; do
            if scan_before_push "${image_name}" "${version}"; then
                push_image "${image_name}" "${version}" "${push_all}"
            else
                error "Security scan failed for ${image_name} - aborting push"
                exit 1
            fi
        done

        success "All images pushed successfully for version ${version}"
        ;;

    "bump")
        bump_type=${2:-patch}
        current_version=$(get_current_version)
        new_version=$(get_next_version "${current_version}" "${bump_type}")

        set_version "${new_version}"

        # Create git tag if in git repository
        if git rev-parse --git-dir > /dev/null 2>&1; then
            git tag "v${new_version}"
            log "Created git tag v${new_version}"
        fi

        success "Version bumped from ${current_version} to ${new_version}"
        ;;

    "release")
        bump_type=${2:-patch}

        # Bump version
        current_version=$(get_current_version)
        new_version=$(get_next_version "${current_version}" "${bump_type}")
        set_version "${new_version}"

        # Build all images
        for image_name in "${IMAGES[@]}"; do
            dockerfile="${PROJECT_ROOT}/packages/${image_name}/Dockerfile.prod"
            context_dir="${PROJECT_ROOT}/packages/${image_name}"

            build_image "${image_name}" "${new_version}" "${dockerfile}" "${context_dir}"
            tag_image "${image_name}" "${new_version}"
        done

        # Scan and push
        for image_name in "${IMAGES[@]}"; do
            if scan_before_push "${image_name}" "${new_version}"; then
                push_image "${image_name}" "${new_version}" "true"
            else
                error "Security scan failed for ${image_name} - aborting release"
                exit 1
            fi
        done

        generate_build_manifest "${new_version}"

        # Create git tag
        if git rev-parse --git-dir > /dev/null 2>&1; then
            git tag "v${new_version}"
            log "Created git tag v${new_version}"
        fi

        success "Released version ${new_version} successfully"
        ;;

    "cleanup")
        keep_count=${2:-10}
        cleanup_old_images "${keep_count}"
        ;;

    "version")
        echo "Current version: $(get_current_version)"
        ;;

    "tags")
        version=${2:-$(get_current_version)}
        image_name=${3:-${IMAGES[0]}}
        git_info=$(get_git_info)

        log "Generated tags for ${image_name}:${version}:"
        generate_image_tags "${version}" "${image_name}" "${git_info}"
        ;;

    "help"|*)
        cat << EOF
Container Versioning Management

Usage: $0 COMMAND [OPTIONS]

Commands:
  build [VERSION]           Build all images with specified version
  push [VERSION] [ALL]      Push images to registry (ALL=true for all tags)
  bump [TYPE]               Bump version (major|minor|patch, default: patch)
  release [TYPE]            Complete release: bump, build, scan, and push
  cleanup [KEEP_COUNT]      Clean up old images (default: keep 10)
  version                   Show current version
  tags [VERSION] [IMAGE]    Show all tags for an image version
  help                      Show this help message

Examples:
  $0 bump minor            # Bump minor version
  $0 build 1.2.3           # Build version 1.2.3
  $0 push 1.2.3 true       # Push version 1.2.3 with all tags
  $0 release minor         # Complete minor release
  $0 cleanup 5             # Keep only 5 most recent images

Environment Variables:
  CONTAINER_REGISTRY       Container registry URL (default: ghcr.io/sovren)
EOF
        ;;
esac
