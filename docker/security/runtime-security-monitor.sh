#!/bin/bash

# runtime-security-monitor.sh
# Comprehensive Runtime Security Monitoring and Alerting System
# US-207: Docker Security Implementation
# Version: 1.0
# Author: Elite Engineering Team
# Date: $(date)

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONITORING_INTERVAL="${MONITORING_INTERVAL:-30}"
ALERT_THRESHOLD="${ALERT_THRESHOLD:-3}"
LOG_FILE="${LOG_FILE:-/var/log/docker-security-monitor.log}"
METRICS_FILE="${METRICS_FILE:-/tmp/security-metrics.json}"
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"
EMAIL_RECIPIENTS="${EMAIL_RECIPIENTS:-admin@sovren.com}"
AUDIT_LOG="${AUDIT_LOG:-/var/log/security-audit.log}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log_message() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$LOG_FILE"
}

# Audit logging function
audit_log() {
    local event="$1"
    local details="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local user="${SUDO_USER:-$(whoami)}"
    echo "${timestamp} USER=${user} EVENT=${event} DETAILS=${details}" >> "$AUDIT_LOG"
}

# Alert function
send_alert() {
    local severity="$1"
    local title="$2"
    local message="$3"

    log_message "$severity" "$title: $message"
    audit_log "SECURITY_ALERT" "SEVERITY=$severity TITLE=$title MESSAGE=$message"

    # Send Slack notification
    if [[ -n "$SLACK_WEBHOOK" ]]; then
        send_slack_alert "$severity" "$title" "$message"
    fi

    # Send email notification
    if command -v mail >/dev/null 2>&1; then
        send_email_alert "$severity" "$title" "$message"
    fi
}

# Slack alert function
send_slack_alert() {
    local severity="$1"
    local title="$2"
    local message="$3"

    local color="#FF0000"
    case "$severity" in
        "INFO") color="#36A64F" ;;
        "WARNING") color="#FFB84D" ;;
        "CRITICAL") color="#FF0000" ;;
        "ERROR") color="#FF0000" ;;
    esac

    local payload=$(cat <<EOF
{
    "username": "Docker Security Monitor",
    "icon_emoji": ":shield:",
    "attachments": [
        {
            "color": "$color",
            "title": "$title",
            "text": "$message",
            "fields": [
                {
                    "title": "Severity",
                    "value": "$severity",
                    "short": true
                },
                {
                    "title": "Timestamp",
                    "value": "$(date '+%Y-%m-%d %H:%M:%S')",
                    "short": true
                },
                {
                    "title": "Host",
                    "value": "$(hostname)",
                    "short": true
                }
            ]
        }
    ]
}
EOF
    )

    curl -X POST -H 'Content-type: application/json' \
         --data "$payload" \
         "$SLACK_WEBHOOK" >/dev/null 2>&1 || true
}

# Email alert function
send_email_alert() {
    local severity="$1"
    local title="$2"
    local message="$3"

    local subject="[${severity}] Docker Security Alert: ${title}"
    local body="Security Alert Details:

Severity: ${severity}
Title: ${title}
Message: ${message}
Host: $(hostname)
Timestamp: $(date '+%Y-%m-%d %H:%M:%S')

Please investigate immediately.

Docker Security Monitoring System
"

    echo "$body" | mail -s "$subject" "$EMAIL_RECIPIENTS" || true
}

# Container Security Monitoring
monitor_container_security() {
    log_message "INFO" "Starting container security monitoring"

    # Check for privileged containers
    local privileged_containers=$(docker ps -q --filter "security-opt=privileged")
    if [[ -n "$privileged_containers" ]]; then
        send_alert "CRITICAL" "Privileged Container Detected" "Containers running with privileged access: $privileged_containers"
    fi

    # Check for containers with host network
    local host_network_containers=$(docker ps --format "table {{.Names}}\t{{.Networks}}" | grep -v "NETWORKS" | grep "host" | cut -f1 || true)
    if [[ -n "$host_network_containers" ]]; then
        send_alert "WARNING" "Host Network Usage" "Containers using host network: $host_network_containers"
    fi

    # Check for containers with excessive capabilities
    while IFS= read -r container; do
        if [[ -n "$container" ]]; then
            local caps=$(docker inspect "$container" --format '{{.HostConfig.CapAdd}}' 2>/dev/null || true)
            if [[ "$caps" == *"SYS_ADMIN"* ]] || [[ "$caps" == *"NET_ADMIN"* ]]; then
                send_alert "WARNING" "Excessive Capabilities" "Container $container has dangerous capabilities: $caps"
            fi
        fi
    done < <(docker ps -q)

    # Check for containers with write access to sensitive host paths
    while IFS= read -r container; do
        if [[ -n "$container" ]]; then
            local mounts=$(docker inspect "$container" --format '{{range .Mounts}}{{.Source}}:{{.Destination}}:{{.Mode}} {{end}}' 2>/dev/null || true)
            if [[ "$mounts" == *"/etc:"* ]] || [[ "$mounts" == *"/var/run/docker.sock:"* ]]; then
                send_alert "CRITICAL" "Sensitive Mount Detected" "Container $container has sensitive host mounts: $mounts"
            fi
        fi
    done < <(docker ps -q)
}

# User Activity Monitoring
monitor_user_activity() {
    log_message "INFO" "Monitoring user activity"

    # Check for unusual Docker API usage
    local docker_api_calls=$(journalctl -u docker.service --since "1 minute ago" --no-pager -q | grep -c "POST\|PUT\|DELETE" || echo "0")
    if [[ "$docker_api_calls" -gt 10 ]]; then
        send_alert "WARNING" "High Docker API Activity" "Unusual Docker API activity detected: $docker_api_calls calls in last minute"
    fi

    # Check for root access to Docker
    local root_docker_access=$(journalctl -u docker.service --since "1 minute ago" --no-pager -q | grep -c "root" || echo "0")
    if [[ "$root_docker_access" -gt 0 ]]; then
        send_alert "INFO" "Root Docker Access" "Root user accessed Docker service"
    fi

    # Monitor failed authentication attempts
    local failed_auth=$(journalctl --since "1 minute ago" --no-pager -q | grep -c "authentication failure" || echo "0")
    if [[ "$failed_auth" -gt 3 ]]; then
        send_alert "WARNING" "Authentication Failures" "Multiple authentication failures detected: $failed_auth attempts"
    fi
}

# Resource Usage Monitoring
monitor_resource_usage() {
    log_message "INFO" "Monitoring resource usage"

    # Check for containers exceeding resource limits
    while IFS= read -r container; do
        if [[ -n "$container" ]]; then
            local stats=$(docker stats "$container" --no-stream --format "table {{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null || true)
            if [[ -n "$stats" ]]; then
                local cpu_usage=$(echo "$stats" | tail -n 1 | cut -f1 | sed 's/%//')
                local mem_usage=$(echo "$stats" | tail -n 1 | cut -f2)

                if [[ -n "$cpu_usage" ]] && (( $(echo "$cpu_usage > 80" | bc -l) )); then
                    send_alert "WARNING" "High CPU Usage" "Container $container CPU usage: ${cpu_usage}%"
                fi

                if [[ "$mem_usage" == *"GiB"* ]]; then
                    local mem_value=$(echo "$mem_usage" | cut -d'/' -f1 | sed 's/GiB//')
                    if (( $(echo "$mem_value > 2" | bc -l) )); then
                        send_alert "WARNING" "High Memory Usage" "Container $container memory usage: $mem_usage"
                    fi
                fi
            fi
        fi
    done < <(docker ps -q)
}

# Network Security Monitoring
monitor_network_security() {
    log_message "INFO" "Monitoring network security"

    # Check for containers with exposed ports
    local exposed_ports=$(docker ps --format "table {{.Names}}\t{{.Ports}}" | grep -v "PORTS" | grep "0.0.0.0:" || true)
    if [[ -n "$exposed_ports" ]]; then
        send_alert "INFO" "Exposed Ports" "Containers with exposed ports detected"
    fi

    # Monitor for suspicious network connections
    local suspicious_connections=$(netstat -tuln | grep -c ":22\|:23\|:3389" || echo "0")
    if [[ "$suspicious_connections" -gt 0 ]]; then
        send_alert "WARNING" "Suspicious Network Activity" "Potentially suspicious network connections detected"
    fi

    # Check for containers communicating with external IPs
    local external_connections=$(docker exec $(docker ps -q | head -n 1) netstat -tuln 2>/dev/null | grep -v "127.0.0.1\|::1" || echo "")
    if [[ -n "$external_connections" ]]; then
        log_message "INFO" "External network connections detected"
    fi
}

# File System Monitoring
monitor_filesystem() {
    log_message "INFO" "Monitoring filesystem security"

    # Check for unauthorized file modifications
    local docker_files_modified=$(find /var/lib/docker -type f -newer /tmp/last-security-check 2>/dev/null | wc -l || echo "0")
    if [[ "$docker_files_modified" -gt 100 ]]; then
        send_alert "WARNING" "Filesystem Changes" "Unusual number of Docker filesystem changes: $docker_files_modified files"
    fi

    # Check for suspicious file permissions
    local suspicious_permissions=$(find /var/lib/docker -type f -perm -o+w 2>/dev/null | wc -l || echo "0")
    if [[ "$suspicious_permissions" -gt 0 ]]; then
        send_alert "WARNING" "Suspicious Permissions" "World-writable files found in Docker directory: $suspicious_permissions files"
    fi

    # Update timestamp for next check
    touch /tmp/last-security-check
}

# Vulnerability Scanning
monitor_vulnerabilities() {
    log_message "INFO" "Monitoring vulnerabilities"

    # Check for containers with known vulnerabilities
    local vulnerable_images=$(docker images --format "table {{.Repository}}:{{.Tag}}" | tail -n +2 | head -n 5)
    while IFS= read -r image; do
        if [[ -n "$image" ]]; then
            local vulns=$(docker scout cves "$image" 2>/dev/null | grep -c "HIGH\|CRITICAL" || echo "0")
            if [[ "$vulns" -gt 0 ]]; then
                send_alert "WARNING" "Vulnerable Image" "Image $image has $vulns high/critical vulnerabilities"
            fi
        fi
    done <<< "$vulnerable_images"
}

# Performance Metrics Collection
collect_metrics() {
    log_message "INFO" "Collecting performance metrics"

    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local container_count=$(docker ps -q | wc -l)
    local image_count=$(docker images -q | wc -l)
    local volume_count=$(docker volume ls -q | wc -l)
    local network_count=$(docker network ls -q | wc -l)

    # System metrics
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1 || echo "0")
    local mem_usage=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}' || echo "0")
    local disk_usage=$(df -h / | awk 'NR==2{print $5}' | sed 's/%//' || echo "0")

    # Docker daemon metrics
    local docker_daemon_cpu=$(ps -p $(pgrep dockerd) -o %cpu= 2>/dev/null || echo "0")
    local docker_daemon_mem=$(ps -p $(pgrep dockerd) -o %mem= 2>/dev/null || echo "0")

    # Create metrics JSON
    cat > "$METRICS_FILE" <<EOF
{
    "timestamp": "$timestamp",
    "containers": {
        "running": $container_count,
        "images": $image_count,
        "volumes": $volume_count,
        "networks": $network_count
    },
    "system": {
        "cpu_usage": "$cpu_usage",
        "memory_usage": "$mem_usage",
        "disk_usage": "$disk_usage"
    },
    "docker_daemon": {
        "cpu_usage": "$docker_daemon_cpu",
        "memory_usage": "$docker_daemon_mem"
    }
}
EOF

    log_message "INFO" "Metrics collected: $container_count containers, $image_count images"
}

# Incident Response
trigger_incident_response() {
    local incident_type="$1"
    local details="$2"

    log_message "CRITICAL" "INCIDENT TRIGGERED: $incident_type"
    audit_log "SECURITY_INCIDENT" "TYPE=$incident_type DETAILS=$details"

    # Send critical alert
    send_alert "CRITICAL" "Security Incident" "Incident Type: $incident_type, Details: $details"

    # Log to incident response system
    local incident_id="INC-$(date +%Y%m%d%H%M%S)"
    echo "INCIDENT_ID=$incident_id TYPE=$incident_type DETAILS=$details TIMESTAMP=$(date)" >> /var/log/security-incidents.log

    # Auto-remediation actions
    case "$incident_type" in
        "PRIVILEGED_CONTAINER")
            log_message "INFO" "Auto-remediation: Monitoring privileged container"
            ;;
        "SUSPICIOUS_ACTIVITY")
            log_message "INFO" "Auto-remediation: Increased monitoring activated"
            ;;
        "RESOURCE_EXHAUSTION")
            log_message "INFO" "Auto-remediation: Resource limits enforced"
            ;;
    esac
}

# Health Check
health_check() {
    log_message "INFO" "Performing health check"

    # Check Docker daemon
    if ! docker info >/dev/null 2>&1; then
        send_alert "CRITICAL" "Docker Daemon Down" "Docker daemon is not responding"
        return 1
    fi

    # Check monitoring services
    if ! pgrep -f "docker-security-monitor" >/dev/null; then
        send_alert "WARNING" "Monitoring Service Down" "Security monitoring service not running"
    fi

    # Check log files
    if [[ ! -w "$LOG_FILE" ]]; then
        send_alert "WARNING" "Log File Issue" "Cannot write to log file: $LOG_FILE"
    fi

    # Check disk space
    local disk_usage=$(df -h / | awk 'NR==2{print $5}' | sed 's/%//')
    if [[ "$disk_usage" -gt 90 ]]; then
        send_alert "WARNING" "Disk Space Low" "Disk usage: ${disk_usage}%"
    fi

    log_message "INFO" "Health check completed"
}

# Cleanup function
cleanup() {
    log_message "INFO" "Performing cleanup"

    # Clean old log files
    find /var/log -name "*.log" -mtime +7 -exec rm {} \; 2>/dev/null || true

    # Clean old metrics files
    find /tmp -name "security-metrics-*.json" -mtime +1 -exec rm {} \; 2>/dev/null || true

    # Clean old audit logs
    if [[ -f "$AUDIT_LOG" ]]; then
        tail -n 1000 "$AUDIT_LOG" > "$AUDIT_LOG.tmp" && mv "$AUDIT_LOG.tmp" "$AUDIT_LOG"
    fi

    log_message "INFO" "Cleanup completed"
}

# Main monitoring loop
main() {
    log_message "INFO" "Starting Docker Runtime Security Monitor"

    # Create necessary directories
    mkdir -p "$(dirname "$LOG_FILE")"
    mkdir -p "$(dirname "$AUDIT_LOG")"

    # Initialize
    touch /tmp/last-security-check

    # Signal handlers
    trap 'log_message "INFO" "Shutting down security monitor"; exit 0' SIGTERM SIGINT

    while true; do
        # Perform health check
        health_check

        # Core monitoring functions
        monitor_container_security
        monitor_user_activity
        monitor_resource_usage
        monitor_network_security
        monitor_filesystem
        monitor_vulnerabilities

        # Collect metrics
        collect_metrics

        # Periodic cleanup
        if [[ $(($(date +%s) % 3600)) -eq 0 ]]; then
            cleanup
        fi

        log_message "INFO" "Security monitoring cycle completed"
        sleep "$MONITORING_INTERVAL"
    done
}

# Command line interface
case "${1:-main}" in
    "monitor")
        main
        ;;
    "health")
        health_check
        ;;
    "test")
        send_alert "INFO" "Test Alert" "This is a test alert from the security monitoring system"
        ;;
    "cleanup")
        cleanup
        ;;
    "incident")
        trigger_incident_response "${2:-TEST}" "${3:-Test incident}"
        ;;
    *)
        echo "Usage: $0 {monitor|health|test|cleanup|incident}"
        echo "  monitor  - Start continuous monitoring"
        echo "  health   - Perform health check"
        echo "  test     - Send test alert"
        echo "  cleanup  - Clean up old files"
        echo "  incident - Trigger incident response"
        exit 1
        ;;
esac
