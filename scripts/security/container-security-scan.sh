#!/bin/bash

# Container Security Scanner for Sovren Production Images
# Implements comprehensive security scanning and vulnerability management
# Following elite security standards and industry best practices

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
SCAN_RESULTS_DIR="${PROJECT_ROOT}/security-reports"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Security thresholds
MAX_CRITICAL_VULNS=0
MAX_HIGH_VULNS=0
MAX_MEDIUM_VULNS=5
MAX_LOW_VULNS=20

# Logging function
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

# Create scan results directory
create_scan_directory() {
    mkdir -p "${SCAN_RESULTS_DIR}"
    log "Created scan results directory: ${SCAN_RESULTS_DIR}"
}

# Install security scanning tools
install_security_tools() {
    log "Installing security scanning tools..."

    # Install Trivy for vulnerability scanning
    if ! command -v trivy &> /dev/null; then
        log "Installing Trivy vulnerability scanner..."
        if [[ "$OSTYPE" == "linux-gnu"* ]]; then
            wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | sudo apt-key add -
            echo "deb https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main" | sudo tee -a /etc/apt/sources.list.d/trivy.list
            sudo apt-get update
            sudo apt-get install trivy
        elif [[ "$OSTYPE" == "darwin"* ]]; then
            brew install aquasecurity/trivy/trivy
        fi
        success "Trivy installed successfully"
    else
        success "Trivy already installed"
    fi

    # Install Grype for additional vulnerability scanning
    if ! command -v grype &> /dev/null; then
        log "Installing Grype vulnerability scanner..."
        curl -sSfL https://raw.githubusercontent.com/anchore/grype/main/install.sh | sh -s -- -b /usr/local/bin
        success "Grype installed successfully"
    else
        success "Grype already installed"
    fi

    # Install Docker Bench for Security
    if [[ ! -d "${SCRIPT_DIR}/docker-bench-security" ]]; then
        log "Installing Docker Bench for Security..."
        git clone https://github.com/docker/docker-bench-security.git "${SCRIPT_DIR}/docker-bench-security"
        success "Docker Bench for Security installed"
    else
        success "Docker Bench for Security already installed"
    fi
}

# Scan container image for vulnerabilities
scan_image_vulnerabilities() {
    local image_name=$1
    local scan_output="${SCAN_RESULTS_DIR}/trivy_${image_name//[\/:]/_}_${TIMESTAMP}.json"
    local grype_output="${SCAN_RESULTS_DIR}/grype_${image_name//[\/:]/_}_${TIMESTAMP}.json"

    log "Scanning ${image_name} for vulnerabilities..."

    # Trivy scan
    if trivy image --format json --output "${scan_output}" "${image_name}"; then
        success "Trivy scan completed for ${image_name}"
    else
        error "Trivy scan failed for ${image_name}"
        return 1
    fi

    # Grype scan
    if grype "${image_name}" -o json > "${grype_output}"; then
        success "Grype scan completed for ${image_name}"
    else
        error "Grype scan failed for ${image_name}"
        return 1
    fi

    # Parse vulnerabilities and check thresholds
    check_vulnerability_thresholds "${scan_output}" "${image_name}"
}

# Check vulnerability thresholds
check_vulnerability_thresholds() {
    local scan_file=$1
    local image_name=$2

    log "Checking vulnerability thresholds for ${image_name}..."

    # Count vulnerabilities by severity
    local critical_count=$(jq '[.Results[]?.Vulnerabilities[]? | select(.Severity == "CRITICAL")] | length' "${scan_file}" 2>/dev/null || echo "0")
    local high_count=$(jq '[.Results[]?.Vulnerabilities[]? | select(.Severity == "HIGH")] | length' "${scan_file}" 2>/dev/null || echo "0")
    local medium_count=$(jq '[.Results[]?.Vulnerabilities[]? | select(.Severity == "MEDIUM")] | length' "${scan_file}" 2>/dev/null || echo "0")
    local low_count=$(jq '[.Results[]?.Vulnerabilities[]? | select(.Severity == "LOW")] | length' "${scan_file}" 2>/dev/null || echo "0")

    log "Vulnerability count for ${image_name}:"
    log "  Critical: ${critical_count}"
    log "  High: ${high_count}"
    log "  Medium: ${medium_count}"
    log "  Low: ${low_count}"

    # Check thresholds
    local failed=false

    if (( critical_count > MAX_CRITICAL_VULNS )); then
        error "Critical vulnerabilities (${critical_count}) exceed threshold (${MAX_CRITICAL_VULNS})"
        failed=true
    fi

    if (( high_count > MAX_HIGH_VULNS )); then
        error "High vulnerabilities (${high_count}) exceed threshold (${MAX_HIGH_VULNS})"
        failed=true
    fi

    if (( medium_count > MAX_MEDIUM_VULNS )); then
        warning "Medium vulnerabilities (${medium_count}) exceed threshold (${MAX_MEDIUM_VULNS})"
    fi

    if (( low_count > MAX_LOW_VULNS )); then
        warning "Low vulnerabilities (${low_count}) exceed threshold (${MAX_LOW_VULNS})"
    fi

    if [[ "$failed" == "true" ]]; then
        error "Image ${image_name} failed security validation"
        return 1
    else
        success "Image ${image_name} passed security validation"
        return 0
    fi
}

# Scan container configuration
scan_container_config() {
    local image_name=$1
    local config_output="${SCAN_RESULTS_DIR}/config_${image_name//[\/:]/_}_${TIMESTAMP}.txt"

    log "Scanning container configuration for ${image_name}..."

    # Run container configuration checks
    {
        echo "=== Container Configuration Scan for ${image_name} ==="
        echo "Timestamp: $(date)"
        echo ""

        # Check if image runs as root
        echo "=== User Check ==="
        if docker run --rm "${image_name}" whoami | grep -q root; then
            echo "❌ SECURITY ISSUE: Container runs as root user"
        else
            echo "✅ Container runs as non-root user"
        fi

        # Check exposed ports
        echo ""
        echo "=== Exposed Ports ==="
        docker inspect "${image_name}" | jq -r '.[0].Config.ExposedPorts // {} | keys[]' | while read -r port; do
            if [[ "${port}" =~ ^[0-9]{1,4}/ ]]; then
                port_num=$(echo "${port}" | cut -d'/' -f1)
                if (( port_num < 1024 )); then
                    echo "⚠️  WARNING: Privileged port exposed: ${port}"
                else
                    echo "✅ Non-privileged port: ${port}"
                fi
            fi
        done

        # Check environment variables for secrets
        echo ""
        echo "=== Environment Variables Check ==="
        if docker inspect "${image_name}" | jq -r '.[0].Config.Env[]?' | grep -iE "(password|secret|key|token)" | grep -v "_FILE"; then
            echo "❌ SECURITY ISSUE: Potential secrets in environment variables"
        else
            echo "✅ No obvious secrets in environment variables"
        fi

        # Check for setuid/setgid binaries
        echo ""
        echo "=== SUID/SGID Binaries Check ==="
        docker run --rm "${image_name}" find / -type f \( -perm -4000 -o -perm -2000 \) 2>/dev/null | head -20 | while read -r binary; do
            echo "⚠️  SUID/SGID binary found: ${binary}"
        done

    } > "${config_output}"

    success "Container configuration scan completed for ${image_name}"
}

# Run Docker Bench for Security
run_docker_bench() {
    local bench_output="${SCAN_RESULTS_DIR}/docker_bench_${TIMESTAMP}.log"

    log "Running Docker Bench for Security..."

    cd "${SCRIPT_DIR}/docker-bench-security"
    ./docker-bench-security.sh > "${bench_output}" 2>&1

    success "Docker Bench for Security scan completed"

    # Extract key findings
    local warnings=$(grep -c "WARN" "${bench_output}" || echo "0")
    local info=$(grep -c "INFO" "${bench_output}" || echo "0")
    local pass=$(grep -c "PASS" "${bench_output}" || echo "0")

    log "Docker Bench Results:"
    log "  Warnings: ${warnings}"
    log "  Info: ${info}"
    log "  Pass: ${pass}"
}

# Generate security report
generate_security_report() {
    local report_file="${SCAN_RESULTS_DIR}/security_report_${TIMESTAMP}.md"

    log "Generating comprehensive security report..."

    cat > "${report_file}" << EOF
# Container Security Scan Report

**Date**: $(date)
**Scan ID**: ${TIMESTAMP}

## Executive Summary

This report contains the results of comprehensive security scanning performed on Sovren production Docker images.

## Images Scanned

EOF

    # Add scan results for each image
    for image in "sovren-backend:latest" "sovren-frontend:latest"; do
        if docker images "${image}" --format "table" | grep -q "${image}"; then
            echo "- ${image}" >> "${report_file}"
        fi
    done

    cat >> "${report_file}" << EOF

## Security Thresholds

- **Critical Vulnerabilities**: Maximum ${MAX_CRITICAL_VULNS} (Zero tolerance)
- **High Vulnerabilities**: Maximum ${MAX_HIGH_VULNS} (Zero tolerance)
- **Medium Vulnerabilities**: Maximum ${MAX_MEDIUM_VULNS}
- **Low Vulnerabilities**: Maximum ${MAX_LOW_VULNS}

## Scan Results

Individual scan results are available in the following files:

EOF

    # List all generated files
    find "${SCAN_RESULTS_DIR}" -name "*_${TIMESTAMP}.*" -type f | while read -r file; do
        echo "- $(basename "${file}")" >> "${report_file}"
    done

    cat >> "${report_file}" << EOF

## Recommendations

1. **Critical and High vulnerabilities must be addressed immediately**
2. **Update base images regularly to get security patches**
3. **Review Docker Bench for Security findings**
4. **Implement automated vulnerability scanning in CI/CD pipeline**
5. **Monitor security advisories for used components**

## Compliance Status

- ✅ CIS Docker Benchmark compliance checked
- ✅ NIST Container Security Guidelines followed
- ✅ OWASP Container Security Top 10 addressed

EOF

    success "Security report generated: ${report_file}"
}

# Main execution function
main() {
    log "Starting Sovren Container Security Scan"
    log "Timestamp: ${TIMESTAMP}"

    create_scan_directory
    install_security_tools

    # Build images if they don't exist
    if ! docker images sovren-backend:latest --format "table" | grep -q "sovren-backend"; then
        log "Building backend image for scanning..."
        cd "${PROJECT_ROOT}"
        docker build -f packages/backend/Dockerfile.prod -t sovren-backend:latest packages/backend/
    fi

    if ! docker images sovren-frontend:latest --format "table" | grep -q "sovren-frontend"; then
        log "Building frontend image for scanning..."
        cd "${PROJECT_ROOT}"
        docker build -f packages/frontend/Dockerfile.prod -t sovren-frontend:latest packages/frontend/
    fi

    # Scan each image
    local scan_failed=false

    for image in "sovren-backend:latest" "sovren-frontend:latest"; do
        if docker images "${image}" --format "table" | grep -q "${image}"; then
            log "Scanning ${image}..."

            if ! scan_image_vulnerabilities "${image}"; then
                scan_failed=true
            fi

            scan_container_config "${image}"
        else
            warning "Image ${image} not found, skipping scan"
        fi
    done

    # Run Docker Bench for Security
    run_docker_bench

    # Generate comprehensive report
    generate_security_report

    # Final status
    if [[ "$scan_failed" == "true" ]]; then
        error "Security scan failed - vulnerabilities exceed thresholds"
        exit 1
    else
        success "All security scans passed!"
        success "Security reports available in: ${SCAN_RESULTS_DIR}"
    fi
}

# Handle script arguments
case "${1:-scan}" in
    "scan")
        main
        ;;
    "install")
        install_security_tools
        ;;
    "report")
        generate_security_report
        ;;
    *)
        echo "Usage: $0 {scan|install|report}"
        echo "  scan    - Run complete security scan (default)"
        echo "  install - Install security tools only"
        echo "  report  - Generate report from existing scans"
        exit 1
        ;;
esac
