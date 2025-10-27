#!/bin/bash
# ========================================
# Sovren - Docker Security Scanning Script
# ========================================
# Comprehensive security scanning with:
# - Trivy vulnerability scanning
# - SBOM generation (CycloneDX & SPDX formats)
# - Image size validation
# - Layer analysis
# - Best practices validation
# ========================================

set -euo pipefail

# ========================================
# Configuration
# ========================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
REPORTS_DIR="${PROJECT_ROOT}/security-reports"
IMAGE_NAME="${1:-sovren-backend:latest}"
MAX_IMAGE_SIZE_MB=150

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

check_dependencies() {
    log_info "Checking dependencies..."

    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi

    if ! command -v trivy &> /dev/null; then
        log_warning "Trivy is not installed. Installing..."
        curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin
    fi

    log_success "All dependencies are available"
}

create_reports_dir() {
    mkdir -p "${REPORTS_DIR}"
    log_info "Reports will be saved to: ${REPORTS_DIR}"
}

# ========================================
# Security Scanning Functions
# ========================================
scan_filesystem() {
    log_info "Scanning filesystem for vulnerabilities..."

    trivy fs \
        --severity HIGH,CRITICAL \
        --format table \
        "${PROJECT_ROOT}/packages/backend"

    log_info "Generating filesystem SARIF report..."
    trivy fs \
        --severity HIGH,CRITICAL \
        --format sarif \
        --output "${REPORTS_DIR}/trivy-fs-results.sarif" \
        "${PROJECT_ROOT}/packages/backend"

    log_success "Filesystem scan complete"
}

scan_image() {
    log_info "Scanning Docker image: ${IMAGE_NAME}"

    # Check if image exists
    if ! docker image inspect "${IMAGE_NAME}" &> /dev/null; then
        log_error "Image ${IMAGE_NAME} not found. Build the image first."
        exit 1
    fi

    # Vulnerability scan
    log_info "Running vulnerability scan..."
    trivy image \
        --severity HIGH,CRITICAL \
        --format table \
        "${IMAGE_NAME}"

    # Generate SARIF report for GitHub Security
    log_info "Generating SARIF report..."
    trivy image \
        --severity HIGH,CRITICAL \
        --format sarif \
        --output "${REPORTS_DIR}/trivy-image-results.sarif" \
        "${IMAGE_NAME}"

    # Generate JSON report for detailed analysis
    log_info "Generating JSON report..."
    trivy image \
        --severity HIGH,CRITICAL \
        --format json \
        --output "${REPORTS_DIR}/trivy-image-results.json" \
        "${IMAGE_NAME}"

    log_success "Image vulnerability scan complete"
}

generate_sbom() {
    log_info "Generating SBOM (Software Bill of Materials)..."

    # Generate CycloneDX SBOM
    log_info "Generating CycloneDX SBOM..."
    trivy image \
        --format cyclonedx \
        --output "${REPORTS_DIR}/sbom-cyclonedx.json" \
        "${IMAGE_NAME}"

    # Generate SPDX SBOM
    log_info "Generating SPDX SBOM..."
    trivy image \
        --format spdx-json \
        --output "${REPORTS_DIR}/sbom-spdx.json" \
        "${IMAGE_NAME}"

    log_success "SBOM generation complete"
}

validate_image_size() {
    log_info "Validating image size..."

    SIZE=$(docker image inspect "${IMAGE_NAME}" --format='{{.Size}}')
    SIZE_MB=$((SIZE / 1024 / 1024))

    echo "Image size: ${SIZE_MB}MB (target: <${MAX_IMAGE_SIZE_MB}MB)"

    if [ $SIZE_MB -gt $MAX_IMAGE_SIZE_MB ]; then
        log_error "Image size ${SIZE_MB}MB exceeds ${MAX_IMAGE_SIZE_MB}MB target"
        return 1
    fi

    log_success "Image size validation passed: ${SIZE_MB}MB"
}

analyze_layers() {
    log_info "Analyzing Docker image layers..."

    echo "Layer breakdown:"
    docker history "${IMAGE_NAME}" --human --no-trunc | tee "${REPORTS_DIR}/layer-analysis.txt"

    log_success "Layer analysis complete"
}

scan_secrets() {
    log_info "Scanning for secrets in image..."

    trivy image \
        --scanners secret \
        --format table \
        "${IMAGE_NAME}"

    trivy image \
        --scanners secret \
        --format json \
        --output "${REPORTS_DIR}/secret-scan-results.json" \
        "${IMAGE_NAME}"

    log_success "Secret scan complete"
}

scan_misconfigurations() {
    log_info "Scanning for misconfigurations..."

    trivy config \
        --severity HIGH,CRITICAL \
        --format table \
        "${PROJECT_ROOT}/packages/backend/Dockerfile"

    trivy config \
        --severity HIGH,CRITICAL \
        --format json \
        --output "${REPORTS_DIR}/config-scan-results.json" \
        "${PROJECT_ROOT}/packages/backend/Dockerfile"

    log_success "Misconfiguration scan complete"
}

generate_summary_report() {
    log_info "Generating summary report..."

    cat > "${REPORTS_DIR}/security-summary.md" << EOF
# Docker Security Scan Summary

**Image:** ${IMAGE_NAME}
**Scan Date:** $(date -u +'%Y-%m-%d %H:%M:%S UTC')

## Image Metrics

$(docker image inspect "${IMAGE_NAME}" --format='
- **Size:** {{.Size}} bytes ($(docker image inspect "${IMAGE_NAME}" --format='{{.Size}}' | awk '{print int($1/1024/1024)}')MB)
- **Architecture:** {{.Architecture}}
- **OS:** {{.Os}}
- **Created:** {{.Created}}
- **Layers:** {{len .RootFS.Layers}}
')

## Security Scans Performed

- ✅ Vulnerability scan (HIGH, CRITICAL)
- ✅ Secret detection
- ✅ Misconfiguration scan
- ✅ SBOM generation (CycloneDX & SPDX)
- ✅ Image size validation
- ✅ Layer analysis

## Reports Generated

- \`trivy-image-results.sarif\` - SARIF format for GitHub Security
- \`trivy-image-results.json\` - Detailed JSON report
- \`sbom-cyclonedx.json\` - CycloneDX SBOM
- \`sbom-spdx.json\` - SPDX SBOM
- \`secret-scan-results.json\` - Secret scan results
- \`config-scan-results.json\` - Configuration scan results
- \`layer-analysis.txt\` - Layer breakdown

## Next Steps

1. Review vulnerability reports in \`security-reports/\`
2. Address any HIGH or CRITICAL vulnerabilities
3. Upload SARIF to GitHub Security tab:
   \`\`\`bash
   gh api -X POST repos/:owner/:repo/code-scanning/sarifs \\
     -F commit_sha=\$(git rev-parse HEAD) \\
     -F ref=refs/heads/\$(git branch --show-current) \\
     -F sarif=@security-reports/trivy-image-results.sarif
   \`\`\`
4. Store SBOM for compliance and audit purposes

EOF

    cat "${REPORTS_DIR}/security-summary.md"
    log_success "Summary report generated: ${REPORTS_DIR}/security-summary.md"
}

# ========================================
# Main Execution
# ========================================
main() {
    echo "========================================="
    echo "Sovren Docker Security Scanner"
    echo "========================================="
    echo ""

    check_dependencies
    create_reports_dir

    echo ""
    log_info "Starting security scan for: ${IMAGE_NAME}"
    echo ""

    # Run all scans
    scan_filesystem
    echo ""

    scan_image
    echo ""

    generate_sbom
    echo ""

    validate_image_size
    echo ""

    analyze_layers
    echo ""

    scan_secrets
    echo ""

    scan_misconfigurations
    echo ""

    generate_summary_report

    echo ""
    echo "========================================="
    log_success "Security scan complete!"
    echo "========================================="
    echo ""
    log_info "Reports saved to: ${REPORTS_DIR}"
    echo ""
}

# Run main function
main "$@"
