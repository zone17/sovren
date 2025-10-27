#!/bin/bash

# Filesystem Security Monitor for Docker Containers
# This script monitors filesystem access and ensures read-only compliance
# It detects unauthorized write attempts and logs security events

set -euo pipefail

# Configuration
MONITOR_LOG="/var/log/sovren/filesystem-monitor.log"
ALERT_LOG="/var/log/sovren/security-alerts.log"
MONITOR_INTERVAL=5
CONTAINER_PREFIX="sovren-"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
EMAIL_ALERTS="${EMAIL_ALERTS:-false}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@sovren.app}"

# Initialize logging
mkdir -p "$(dirname "$MONITOR_LOG")"
mkdir -p "$(dirname "$ALERT_LOG")"

# Function to log messages
log_message() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$MONITOR_LOG"
}

# Function to log security alerts
log_security_alert() {
    local severity="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [SECURITY-$severity] $message" | tee -a "$ALERT_LOG"

    # Send alert notifications
    send_alert_notification "$severity" "$message"
}

# Function to send alert notifications
send_alert_notification() {
    local severity="$1"
    local message="$2"

    # Send Slack notification if webhook configured
    if [[ -n "$SLACK_WEBHOOK_URL" ]]; then
        send_slack_alert "$severity" "$message"
    fi

    # Send email notification if configured
    if [[ "$EMAIL_ALERTS" == "true" ]]; then
        send_email_alert "$severity" "$message"
    fi
}

# Function to send Slack alerts
send_slack_alert() {
    local severity="$1"
    local message="$2"
    local color="danger"

    case "$severity" in
        "LOW") color="warning" ;;
        "MEDIUM") color="warning" ;;
        "HIGH") color="danger" ;;
        "CRITICAL") color="danger" ;;
    esac

    local payload=$(cat <<EOF
{
    "username": "Sovren Security Monitor",
    "icon_emoji": ":warning:",
    "attachments": [
        {
            "color": "$color",
            "title": "Docker Security Alert - $severity",
            "text": "$message",
            "fields": [
                {
                    "title": "Hostname",
                    "value": "$(hostname)",
                    "short": true
                },
                {
                    "title": "Timestamp",
                    "value": "$(date)",
                    "short": true
                }
            ]
        }
    ]
}
EOF
)

    curl -X POST \
        -H 'Content-type: application/json' \
        --data "$payload" \
        "$SLACK_WEBHOOK_URL" 2>/dev/null || true
}

# Function to send email alerts
send_email_alert() {
    local severity="$1"
    local message="$2"

    local subject="[Sovren Security] Docker Security Alert - $severity"
    local body="Docker Security Alert

Severity: $severity
Message: $message
Hostname: $(hostname)
Timestamp: $(date)

Please investigate this security event immediately.

This is an automated alert from the Sovren Docker Security Monitor."

    echo "$body" | mail -s "$subject" "$ADMIN_EMAIL" 2>/dev/null || true
}

# Function to check container read-only status
check_container_readonly() {
    local container_id="$1"
    local container_name="$2"

    # Check if container is running with read-only filesystem
    local readonly_status=$(docker inspect "$container_id" --format='{{.HostConfig.ReadonlyRootfs}}' 2>/dev/null || echo "false")

    if [[ "$readonly_status" != "true" ]]; then
        log_security_alert "HIGH" "Container $container_name ($container_id) is not running with read-only filesystem"
        return 1
    fi

    return 0
}

# Function to check container security options
check_container_security_options() {
    local container_id="$1"
    local container_name="$2"

    # Check security options
    local security_opts=$(docker inspect "$container_id" --format='{{.HostConfig.SecurityOpt}}' 2>/dev/null || echo "[]")

    # Check for no-new-privileges
    if ! echo "$security_opts" | grep -q "no-new-privileges:true"; then
        log_security_alert "MEDIUM" "Container $container_name ($container_id) is not running with no-new-privileges"
    fi

    # Check for seccomp
    if ! echo "$security_opts" | grep -q "seccomp:default"; then
        log_security_alert "MEDIUM" "Container $container_name ($container_id) is not using default seccomp profile"
    fi

    # Check for AppArmor
    if ! echo "$security_opts" | grep -q "apparmor:docker-default"; then
        log_security_alert "MEDIUM" "Container $container_name ($container_id) is not using default AppArmor profile"
    fi
}

# Function to check container capabilities
check_container_capabilities() {
    local container_id="$1"
    local container_name="$2"

    # Check dropped capabilities
    local cap_drop=$(docker inspect "$container_id" --format='{{.HostConfig.CapDrop}}' 2>/dev/null || echo "[]")

    if ! echo "$cap_drop" | grep -q "ALL"; then
        log_security_alert "HIGH" "Container $container_name ($container_id) has not dropped ALL capabilities"
    fi

    # Check added capabilities
    local cap_add=$(docker inspect "$container_id" --format='{{.HostConfig.CapAdd}}' 2>/dev/null || echo "[]")

    # Log any added capabilities for review
    if [[ "$cap_add" != "[]" && "$cap_add" != "<nil>" ]]; then
        log_message "INFO" "Container $container_name ($container_id) has added capabilities: $cap_add"
    fi
}

# Function to check container resource limits
check_container_resources() {
    local container_id="$1"
    local container_name="$2"

    # Check memory limit
    local memory_limit=$(docker inspect "$container_id" --format='{{.HostConfig.Memory}}' 2>/dev/null || echo "0")
    if [[ "$memory_limit" == "0" ]]; then
        log_security_alert "MEDIUM" "Container $container_name ($container_id) has no memory limit set"
    fi

    # Check CPU limit
    local cpu_quota=$(docker inspect "$container_id" --format='{{.HostConfig.CpuQuota}}' 2>/dev/null || echo "0")
    if [[ "$cpu_quota" == "0" ]]; then
        log_security_alert "MEDIUM" "Container $container_name ($container_id) has no CPU quota set"
    fi

    # Check PID limit
    local pid_limit=$(docker inspect "$container_id" --format='{{.HostConfig.PidsLimit}}' 2>/dev/null || echo "0")
    if [[ "$pid_limit" == "0" ]]; then
        log_security_alert "MEDIUM" "Container $container_name ($container_id) has no PID limit set"
    fi
}

# Function to check container user
check_container_user() {
    local container_id="$1"
    local container_name="$2"

    # Check if container is running as root
    local user=$(docker inspect "$container_id" --format='{{.Config.User}}' 2>/dev/null || echo "")

    if [[ -z "$user" || "$user" == "root" || "$user" == "0" ]]; then
        log_security_alert "HIGH" "Container $container_name ($container_id) is running as root user"
    fi
}

# Function to check for filesystem modifications
check_filesystem_modifications() {
    local container_id="$1"
    local container_name="$2"

    # Check for filesystem changes
    local changes=$(docker diff "$container_id" 2>/dev/null | head -20)

    if [[ -n "$changes" ]]; then
        log_security_alert "MEDIUM" "Container $container_name ($container_id) has filesystem modifications:
$changes"
    fi
}

# Function to check container network security
check_container_network() {
    local container_id="$1"
    local container_name="$2"

    # Check network mode
    local network_mode=$(docker inspect "$container_id" --format='{{.HostConfig.NetworkMode}}' 2>/dev/null || echo "")

    if [[ "$network_mode" == "host" ]]; then
        log_security_alert "HIGH" "Container $container_name ($container_id) is using host network mode"
    fi

    # Check privileged mode
    local privileged=$(docker inspect "$container_id" --format='{{.HostConfig.Privileged}}' 2>/dev/null || echo "false")

    if [[ "$privileged" == "true" ]]; then
        log_security_alert "CRITICAL" "Container $container_name ($container_id) is running in privileged mode"
    fi
}

# Function to monitor container logs for security events
monitor_container_logs() {
    local container_id="$1"
    local container_name="$2"

    # Check for security-related log entries
    local recent_logs=$(docker logs --since="$MONITOR_INTERVAL"s "$container_id" 2>&1 | grep -i -E "(error|fail|denied|unauthorized|security|attack|intrusion|breach)" | head -5)

    if [[ -n "$recent_logs" ]]; then
        log_security_alert "MEDIUM" "Container $container_name ($container_id) has security-related log entries:
$recent_logs"
    fi
}

# Function to perform comprehensive container security check
check_container_security() {
    local container_id="$1"
    local container_name="$2"

    log_message "INFO" "Checking security for container $container_name ($container_id)"

    # Perform all security checks
    check_container_readonly "$container_id" "$container_name"
    check_container_security_options "$container_id" "$container_name"
    check_container_capabilities "$container_id" "$container_name"
    check_container_resources "$container_id" "$container_name"
    check_container_user "$container_id" "$container_name"
    check_filesystem_modifications "$container_id" "$container_name"
    check_container_network "$container_id" "$container_name"
    monitor_container_logs "$container_id" "$container_name"
}

# Function to check Docker daemon security
check_docker_daemon_security() {
    # Check Docker daemon configuration
    local daemon_config="/etc/docker/daemon.json"

    if [[ ! -f "$daemon_config" ]]; then
        log_security_alert "HIGH" "Docker daemon configuration file not found: $daemon_config"
        return 1
    fi

    # Check for user namespace remapping
    if ! jq -e '.["userns-remap"]' "$daemon_config" >/dev/null 2>&1; then
        log_security_alert "HIGH" "Docker daemon is not configured with user namespace remapping"
    fi

    # Check for live restore
    if ! jq -e '.["live-restore"]' "$daemon_config" >/dev/null 2>&1; then
        log_security_alert "MEDIUM" "Docker daemon is not configured with live restore"
    fi

    # Check for no-new-privileges
    if ! jq -e '.["no-new-privileges"]' "$daemon_config" >/dev/null 2>&1; then
        log_security_alert "MEDIUM" "Docker daemon is not configured with no-new-privileges"
    fi
}

# Function to generate security report
generate_security_report() {
    local report_file="/var/log/sovren/security-report-$(date +%Y%m%d-%H%M%S).json"

    local running_containers=$(docker ps --filter "name=$CONTAINER_PREFIX" --format "table {{.ID}}\t{{.Names}}\t{{.Status}}" | tail -n +2)
    local container_count=$(echo "$running_containers" | wc -l)

    local report=$(cat <<EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "hostname": "$(hostname)",
    "monitor_version": "1.0.0",
    "total_containers": $container_count,
    "containers_checked": [],
    "security_violations": [],
    "recommendations": []
}
EOF
)

    echo "$report" > "$report_file"
    log_message "INFO" "Security report generated: $report_file"
}

# Main monitoring loop
main() {
    log_message "INFO" "Starting Docker filesystem security monitor"

    # Check Docker daemon security once
    check_docker_daemon_security

    while true; do
        # Get running containers with our prefix
        mapfile -t containers < <(docker ps --filter "name=$CONTAINER_PREFIX" --format "{{.ID}} {{.Names}}")

        if [[ ${#containers[@]} -eq 0 ]]; then
            log_message "INFO" "No containers found with prefix '$CONTAINER_PREFIX'"
        else
            for container_info in "${containers[@]}"; do
                if [[ -n "$container_info" ]]; then
                    read -r container_id container_name <<< "$container_info"
                    check_container_security "$container_id" "$container_name"
                fi
            done
        fi

        # Generate periodic security report
        if (( $(date +%s) % 3600 == 0 )); then
            generate_security_report
        fi

        log_message "DEBUG" "Sleeping for $MONITOR_INTERVAL seconds"
        sleep "$MONITOR_INTERVAL"
    done
}

# Handle signals
trap 'log_message "INFO" "Received signal, shutting down filesystem monitor"; exit 0' SIGTERM SIGINT

# Check dependencies
if ! command -v docker >/dev/null 2>&1; then
    echo "Error: docker command not found" >&2
    exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
    echo "Error: jq command not found" >&2
    exit 1
fi

# Start monitoring
main
