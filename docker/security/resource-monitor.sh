#!/bin/bash

# Docker Resource Monitor and Enforcer
# This script monitors container resource usage and enforces resource limits
# following security best practices and operational requirements

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/resource-limits.yaml"
LOG_FILE="/var/log/sovren/resource-monitor.log"
METRICS_FILE="/var/log/sovren/resource-metrics.log"
ALERT_FILE="/var/log/sovren/resource-alerts.log"

# Runtime variables
CONTAINER_PREFIX="sovren-"
MONITOR_INTERVAL=10
ALERT_THRESHOLD_CPU=80
ALERT_THRESHOLD_MEMORY=80
ALERT_THRESHOLD_DISK=80
CRITICAL_THRESHOLD_CPU=90
CRITICAL_THRESHOLD_MEMORY=90
CRITICAL_THRESHOLD_DISK=90

# Alert configuration
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
EMAIL_ALERTS="${EMAIL_ALERTS:-false}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@sovren.app}"
PAGERDUTY_SERVICE_KEY="${PAGERDUTY_SERVICE_KEY:-}"

# Initialize logging
mkdir -p "$(dirname "$LOG_FILE")"
mkdir -p "$(dirname "$METRICS_FILE")"
mkdir -p "$(dirname "$ALERT_FILE")"

# Logging function
log_message() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

# Metrics logging function
log_metrics() {
    local container_name="$1"
    local metric_type="$2"
    local metric_value="$3"
    local threshold="$4"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    echo "[$timestamp] $container_name,$metric_type,$metric_value,$threshold" >> "$METRICS_FILE"
}

# Alert logging function
log_alert() {
    local severity="$1"
    local container_name="$2"
    local alert_type="$3"
    local message="$4"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    echo "[$timestamp] [$severity] $container_name: $alert_type - $message" | tee -a "$ALERT_FILE"

    # Send notifications
    send_alert_notification "$severity" "$container_name" "$alert_type" "$message"
}

# Send alert notifications
send_alert_notification() {
    local severity="$1"
    local container_name="$2"
    local alert_type="$3"
    local message="$4"

    # Send Slack notification
    if [[ -n "$SLACK_WEBHOOK_URL" ]]; then
        send_slack_alert "$severity" "$container_name" "$alert_type" "$message"
    fi

    # Send email notification
    if [[ "$EMAIL_ALERTS" == "true" ]]; then
        send_email_alert "$severity" "$container_name" "$alert_type" "$message"
    fi

    # Send PagerDuty alert for critical issues
    if [[ "$severity" == "CRITICAL" && -n "$PAGERDUTY_SERVICE_KEY" ]]; then
        send_pagerduty_alert "$container_name" "$alert_type" "$message"
    fi
}

# Send Slack alert
send_slack_alert() {
    local severity="$1"
    local container_name="$2"
    local alert_type="$3"
    local message="$4"

    local color="danger"
    case "$severity" in
        "WARNING") color="warning" ;;
        "CRITICAL") color="danger" ;;
        "INFO") color="good" ;;
    esac

    local payload=$(cat <<EOF
{
    "username": "Sovren Resource Monitor",
    "icon_emoji": ":warning:",
    "attachments": [
        {
            "color": "$color",
            "title": "Container Resource Alert - $severity",
            "text": "Container: $container_name\nAlert: $alert_type\nMessage: $message",
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

# Send email alert
send_email_alert() {
    local severity="$1"
    local container_name="$2"
    local alert_type="$3"
    local message="$4"

    local subject="[Sovren Resource Alert] $severity - $container_name"
    local body="Container Resource Alert

Severity: $severity
Container: $container_name
Alert Type: $alert_type
Message: $message
Hostname: $(hostname)
Timestamp: $(date)

Please investigate this resource issue immediately.

This is an automated alert from the Sovren Resource Monitor."

    echo "$body" | mail -s "$subject" "$ADMIN_EMAIL" 2>/dev/null || true
}

# Send PagerDuty alert
send_pagerduty_alert() {
    local container_name="$1"
    local alert_type="$2"
    local message="$3"

    local payload=$(cat <<EOF
{
    "service_key": "$PAGERDUTY_SERVICE_KEY",
    "event_type": "trigger",
    "description": "Critical resource alert for container $container_name",
    "details": {
        "container": "$container_name",
        "alert_type": "$alert_type",
        "message": "$message",
        "hostname": "$(hostname)",
        "timestamp": "$(date)"
    }
}
EOF
)

    curl -X POST \
        -H 'Content-type: application/json' \
        --data "$payload" \
        "https://events.pagerduty.com/generic/2010-04-15/create_event.json" 2>/dev/null || true
}

# Get container resource usage
get_container_stats() {
    local container_id="$1"
    local container_name="$2"

    # Get container stats
    local stats=$(docker stats --no-stream --format "{{.CPUPerc}},{{.MemUsage}},{{.MemPerc}},{{.NetIO}},{{.BlockIO}},{{.PIDs}}" "$container_id" 2>/dev/null || echo "0.00%,0B / 0B,0.00%,0B / 0B,0B / 0B,0")

    # Parse stats
    IFS=',' read -r cpu_percent mem_usage mem_percent net_io block_io pids <<< "$stats"

    # Clean up percentage values
    cpu_percent="${cpu_percent%\%}"
    mem_percent="${mem_percent%\%}"

    # Convert to numbers
    cpu_usage=$(echo "$cpu_percent" | sed 's/%//g')
    memory_usage=$(echo "$mem_percent" | sed 's/%//g')

    # Return usage data
    echo "$cpu_usage,$memory_usage,$pids"
}

# Check CPU usage
check_cpu_usage() {
    local container_id="$1"
    local container_name="$2"
    local cpu_usage="$3"

    # Convert to integer for comparison
    local cpu_int=$(echo "$cpu_usage" | cut -d'.' -f1)

    # Log metrics
    log_metrics "$container_name" "cpu" "$cpu_usage" "$ALERT_THRESHOLD_CPU"

    # Check thresholds
    if (( cpu_int >= CRITICAL_THRESHOLD_CPU )); then
        log_alert "CRITICAL" "$container_name" "CPU_USAGE" "CPU usage is $cpu_usage% (critical threshold: $CRITICAL_THRESHOLD_CPU%)"

        # Take corrective action
        throttle_container_cpu "$container_id" "$container_name"

    elif (( cpu_int >= ALERT_THRESHOLD_CPU )); then
        log_alert "WARNING" "$container_name" "CPU_USAGE" "CPU usage is $cpu_usage% (warning threshold: $ALERT_THRESHOLD_CPU%)"
    fi
}

# Check memory usage
check_memory_usage() {
    local container_id="$1"
    local container_name="$2"
    local memory_usage="$3"

    # Convert to integer for comparison
    local memory_int=$(echo "$memory_usage" | cut -d'.' -f1)

    # Log metrics
    log_metrics "$container_name" "memory" "$memory_usage" "$ALERT_THRESHOLD_MEMORY"

    # Check thresholds
    if (( memory_int >= CRITICAL_THRESHOLD_MEMORY )); then
        log_alert "CRITICAL" "$container_name" "MEMORY_USAGE" "Memory usage is $memory_usage% (critical threshold: $CRITICAL_THRESHOLD_MEMORY%)"

        # Take corrective action
        restart_container_if_needed "$container_id" "$container_name"

    elif (( memory_int >= ALERT_THRESHOLD_MEMORY )); then
        log_alert "WARNING" "$container_name" "MEMORY_USAGE" "Memory usage is $memory_usage% (warning threshold: $ALERT_THRESHOLD_MEMORY%)"
    fi
}

# Check PID usage
check_pid_usage() {
    local container_id="$1"
    local container_name="$2"
    local pids="$3"

    # Get PID limit from container inspect
    local pid_limit=$(docker inspect "$container_id" --format='{{.HostConfig.PidsLimit}}' 2>/dev/null || echo "0")

    if [[ "$pid_limit" != "0" && "$pid_limit" != "<nil>" ]]; then
        local pid_usage_percent=$(( (pids * 100) / pid_limit ))

        # Log metrics
        log_metrics "$container_name" "pids" "$pids" "$pid_limit"

        # Check thresholds
        if (( pid_usage_percent >= 90 )); then
            log_alert "CRITICAL" "$container_name" "PID_USAGE" "PID usage is $pids/$pid_limit ($pid_usage_percent%)"
        elif (( pid_usage_percent >= 80 )); then
            log_alert "WARNING" "$container_name" "PID_USAGE" "PID usage is $pids/$pid_limit ($pid_usage_percent%)"
        fi
    fi
}

# Check disk usage
check_disk_usage() {
    local container_id="$1"
    local container_name="$2"

    # Get container filesystem usage
    local disk_usage=$(docker exec "$container_id" df -h / 2>/dev/null | tail -1 | awk '{print $5}' | sed 's/%//g' || echo "0")

    # Convert to integer
    local disk_int=$(echo "$disk_usage" | cut -d'.' -f1)

    # Log metrics
    log_metrics "$container_name" "disk" "$disk_usage" "$ALERT_THRESHOLD_DISK"

    # Check thresholds
    if (( disk_int >= CRITICAL_THRESHOLD_DISK )); then
        log_alert "CRITICAL" "$container_name" "DISK_USAGE" "Disk usage is $disk_usage% (critical threshold: $CRITICAL_THRESHOLD_DISK%)"

        # Take corrective action
        cleanup_container_logs "$container_id" "$container_name"

    elif (( disk_int >= ALERT_THRESHOLD_DISK )); then
        log_alert "WARNING" "$container_name" "DISK_USAGE" "Disk usage is $disk_usage% (warning threshold: $ALERT_THRESHOLD_DISK%)"
    fi
}

# Throttle container CPU
throttle_container_cpu() {
    local container_id="$1"
    local container_name="$2"

    log_message "INFO" "Throttling CPU for container $container_name"

    # Reduce CPU quota temporarily
    docker update --cpus="0.25" "$container_id" 2>/dev/null || true

    # Schedule CPU quota restoration
    (
        sleep 300  # Wait 5 minutes
        docker update --cpus="0.5" "$container_id" 2>/dev/null || true
        log_message "INFO" "Restored CPU quota for container $container_name"
    ) &
}

# Restart container if needed
restart_container_if_needed() {
    local container_id="$1"
    local container_name="$2"

    # Check if container is healthy
    local health_status=$(docker inspect "$container_id" --format='{{.State.Health.Status}}' 2>/dev/null || echo "unknown")

    if [[ "$health_status" == "unhealthy" ]]; then
        log_message "WARNING" "Restarting unhealthy container $container_name due to high memory usage"
        docker restart "$container_id" 2>/dev/null || true
    fi
}

# Cleanup container logs
cleanup_container_logs() {
    local container_id="$1"
    local container_name="$2"

    log_message "INFO" "Cleaning up logs for container $container_name"

    # Truncate container logs
    docker exec "$container_id" find /var/log -name "*.log" -type f -exec truncate -s 0 {} \; 2>/dev/null || true

    # Clean up temporary files
    docker exec "$container_id" find /tmp -type f -mtime +1 -delete 2>/dev/null || true
}

# Validate container resource limits
validate_container_limits() {
    local container_id="$1"
    local container_name="$2"

    # Check if container has resource limits
    local memory_limit=$(docker inspect "$container_id" --format='{{.HostConfig.Memory}}' 2>/dev/null || echo "0")
    local cpu_quota=$(docker inspect "$container_id" --format='{{.HostConfig.CpuQuota}}' 2>/dev/null || echo "0")
    local cpu_period=$(docker inspect "$container_id" --format='{{.HostConfig.CpuPeriod}}' 2>/dev/null || echo "0")
    local pid_limit=$(docker inspect "$container_id" --format='{{.HostConfig.PidsLimit}}' 2>/dev/null || echo "0")

    # Check memory limit
    if [[ "$memory_limit" == "0" ]]; then
        log_alert "WARNING" "$container_name" "NO_MEMORY_LIMIT" "Container has no memory limit set"
    fi

    # Check CPU limit
    if [[ "$cpu_quota" == "0" ]]; then
        log_alert "WARNING" "$container_name" "NO_CPU_LIMIT" "Container has no CPU limit set"
    fi

    # Check PID limit
    if [[ "$pid_limit" == "0" ]]; then
        log_alert "WARNING" "$container_name" "NO_PID_LIMIT" "Container has no PID limit set"
    fi
}

# Check container security settings
check_container_security() {
    local container_id="$1"
    local container_name="$2"

    # Check if container is running as root
    local user=$(docker inspect "$container_id" --format='{{.Config.User}}' 2>/dev/null || echo "")
    if [[ -z "$user" || "$user" == "root" || "$user" == "0" ]]; then
        log_alert "WARNING" "$container_name" "RUNNING_AS_ROOT" "Container is running as root user"
    fi

    # Check if container is privileged
    local privileged=$(docker inspect "$container_id" --format='{{.HostConfig.Privileged}}' 2>/dev/null || echo "false")
    if [[ "$privileged" == "true" ]]; then
        log_alert "CRITICAL" "$container_name" "PRIVILEGED_CONTAINER" "Container is running in privileged mode"
    fi

    # Check capabilities
    local cap_add=$(docker inspect "$container_id" --format='{{.HostConfig.CapAdd}}' 2>/dev/null || echo "[]")
    local cap_drop=$(docker inspect "$container_id" --format='{{.HostConfig.CapDrop}}' 2>/dev/null || echo "[]")

    if [[ "$cap_drop" != "[ALL]" && "$cap_drop" != *"ALL"* ]]; then
        log_alert "WARNING" "$container_name" "CAPABILITIES_NOT_DROPPED" "Container has not dropped all capabilities"
    fi
}

# Monitor container resources
monitor_container() {
    local container_id="$1"
    local container_name="$2"

    log_message "DEBUG" "Monitoring container $container_name ($container_id)"

    # Get container stats
    local stats=$(get_container_stats "$container_id" "$container_name")
    IFS=',' read -r cpu_usage memory_usage pids <<< "$stats"

    # Check resource usage
    check_cpu_usage "$container_id" "$container_name" "$cpu_usage"
    check_memory_usage "$container_id" "$container_name" "$memory_usage"
    check_pid_usage "$container_id" "$container_name" "$pids"
    check_disk_usage "$container_id" "$container_name"

    # Validate resource limits
    validate_container_limits "$container_id" "$container_name"

    # Check security settings
    check_container_security "$container_id" "$container_name"
}

# Generate resource report
generate_resource_report() {
    local report_file="/var/log/sovren/resource-report-$(date +%Y%m%d-%H%M%S).json"

    local containers=$(docker ps --filter "name=$CONTAINER_PREFIX" --format "{{.ID}} {{.Names}}")
    local container_count=$(echo "$containers" | wc -l)

    local report=$(cat <<EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "hostname": "$(hostname)",
    "monitor_version": "1.0.0",
    "total_containers": $container_count,
    "containers": [],
    "system_resources": {
        "cpu_usage": "$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | sed 's/%us,//')",
        "memory_usage": "$(free | grep Mem | awk '{printf "%.2f", $3/$2 * 100.0}')",
        "disk_usage": "$(df -h / | tail -1 | awk '{print $5}' | sed 's/%//')"
    },
    "alerts_summary": {
        "critical": $(grep -c "CRITICAL" "$ALERT_FILE" 2>/dev/null || echo 0),
        "warning": $(grep -c "WARNING" "$ALERT_FILE" 2>/dev/null || echo 0),
        "info": $(grep -c "INFO" "$ALERT_FILE" 2>/dev/null || echo 0)
    }
}
EOF
)

    echo "$report" > "$report_file"
    log_message "INFO" "Resource report generated: $report_file"
}

# Main monitoring loop
main() {
    log_message "INFO" "Starting Docker resource monitor"

    # Create initial report
    generate_resource_report

    while true; do
        # Get running containers with our prefix
        mapfile -t containers < <(docker ps --filter "name=$CONTAINER_PREFIX" --format "{{.ID}} {{.Names}}")

        if [[ ${#containers[@]} -eq 0 ]]; then
            log_message "INFO" "No containers found with prefix '$CONTAINER_PREFIX'"
        else
            for container_info in "${containers[@]}"; do
                if [[ -n "$container_info" ]]; then
                    read -r container_id container_name <<< "$container_info"
                    monitor_container "$container_id" "$container_name"
                fi
            done
        fi

        # Generate periodic report
        if (( $(date +%s) % 3600 == 0 )); then
            generate_resource_report
        fi

        log_message "DEBUG" "Sleeping for $MONITOR_INTERVAL seconds"
        sleep "$MONITOR_INTERVAL"
    done
}

# Handle signals
trap 'log_message "INFO" "Received signal, shutting down resource monitor"; exit 0' SIGTERM SIGINT

# Check dependencies
if ! command -v docker >/dev/null 2>&1; then
    echo "Error: docker command not found" >&2
    exit 1
fi

# Start monitoring
main
