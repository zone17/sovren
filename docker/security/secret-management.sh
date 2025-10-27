#!/bin/bash

# Docker Secret Management System
# This script provides secure secret management for Docker containers
# including secret injection, rotation, and auditing capabilities

set -euo pipefail

# Configuration
SECRETS_DIR="/etc/sovren/secrets"
SECRETS_BACKUP_DIR="/var/backups/sovren/secrets"
SECRETS_LOG="/var/log/sovren/secret-management.log"
AUDIT_LOG="/var/log/sovren/secret-audit.log"
ROTATION_LOG="/var/log/sovren/secret-rotation.log"

# Secret categories
SECRET_CATEGORIES=(
    "database"
    "redis"
    "jwt"
    "api_keys"
    "certificates"
    "webhook_urls"
    "encryption_keys"
)

# Rotation intervals in days
declare -A ROTATION_INTERVALS
ROTATION_INTERVALS["database"]=90
ROTATION_INTERVALS["redis"]=60
ROTATION_INTERVALS["jwt"]=30
ROTATION_INTERVALS["api_keys"]=180
ROTATION_INTERVALS["certificates"]=365
ROTATION_INTERVALS["webhook_urls"]=90
ROTATION_INTERVALS["encryption_keys"]=90

# Alert configuration
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
EMAIL_ALERTS="${EMAIL_ALERTS:-false}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@sovren.app}"

# Initialize directories
mkdir -p "$SECRETS_DIR" "$SECRETS_BACKUP_DIR"
mkdir -p "$(dirname "$SECRETS_LOG")"
mkdir -p "$(dirname "$AUDIT_LOG")"
mkdir -p "$(dirname "$ROTATION_LOG")"

# Set secure permissions
chmod 700 "$SECRETS_DIR"
chmod 700 "$SECRETS_BACKUP_DIR"

# Logging function
log_message() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$SECRETS_LOG"
}

# Audit logging function
log_audit() {
    local action="$1"
    local secret_name="$2"
    local user="${3:-system}"
    local result="$4"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    echo "[$timestamp] ACTION=$action SECRET=$secret_name USER=$user RESULT=$result" >> "$AUDIT_LOG"
}

# Rotation logging function
log_rotation() {
    local secret_name="$1"
    local old_hash="$2"
    local new_hash="$3"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    echo "[$timestamp] ROTATED SECRET=$secret_name OLD_HASH=$old_hash NEW_HASH=$new_hash" >> "$ROTATION_LOG"
}

# Send alert notifications
send_alert() {
    local severity="$1"
    local message="$2"

    log_message "$severity" "$message"

    # Send Slack notification
    if [[ -n "$SLACK_WEBHOOK_URL" ]]; then
        send_slack_alert "$severity" "$message"
    fi

    # Send email notification
    if [[ "$EMAIL_ALERTS" == "true" ]]; then
        send_email_alert "$severity" "$message"
    fi
}

# Send Slack alert
send_slack_alert() {
    local severity="$1"
    local message="$2"

    local color="danger"
    case "$severity" in
        "INFO") color="good" ;;
        "WARNING") color="warning" ;;
        "CRITICAL") color="danger" ;;
    esac

    local payload=$(cat <<EOF
{
    "username": "Sovren Secret Manager",
    "icon_emoji": ":key:",
    "attachments": [
        {
            "color": "$color",
            "title": "Secret Management Alert - $severity",
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

# Send email alert
send_email_alert() {
    local severity="$1"
    local message="$2"

    local subject="[Sovren Secret Management] $severity Alert"
    local body="Secret Management Alert

Severity: $severity
Message: $message
Hostname: $(hostname)
Timestamp: $(date)

This is an automated alert from the Sovren Secret Management System."

    echo "$body" | mail -s "$subject" "$ADMIN_EMAIL" 2>/dev/null || true
}

# Generate secure random password
generate_password() {
    local length="${1:-32}"
    local charset="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"

    # Use /dev/urandom for cryptographically secure random generation
    LC_ALL=C tr -dc "$charset" < /dev/urandom | head -c "$length"
}

# Generate secure API key
generate_api_key() {
    local prefix="${1:-sk}"
    local length="${2:-48}"

    local key_part=$(openssl rand -base64 "$length" | tr -d "=+/" | cut -c1-"$length")
    echo "${prefix}_${key_part}"
}

# Generate JWT secret
generate_jwt_secret() {
    local length="${1:-64}"
    openssl rand -base64 "$length" | tr -d "=+/"
}

# Encrypt secret
encrypt_secret() {
    local secret="$1"
    local key_file="$2"

    echo "$secret" | openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 -in - -out - -pass file:"$key_file" | base64 -w 0
}

# Decrypt secret
decrypt_secret() {
    local encrypted_secret="$1"
    local key_file="$2"

    echo "$encrypted_secret" | base64 -d | openssl enc -aes-256-cbc -d -salt -pbkdf2 -iter 100000 -in - -out - -pass file:"$key_file"
}

# Generate encryption key
generate_encryption_key() {
    local key_file="$1"
    openssl rand -base64 32 > "$key_file"
    chmod 600 "$key_file"
}

# Create secret
create_secret() {
    local secret_name="$1"
    local secret_value="$2"
    local category="${3:-general}"
    local user="${4:-system}"

    local secret_file="$SECRETS_DIR/$secret_name"
    local key_file="$SECRETS_DIR/.$secret_name.key"
    local metadata_file="$SECRETS_DIR/.$secret_name.metadata"

    # Generate encryption key if it doesn't exist
    if [[ ! -f "$key_file" ]]; then
        generate_encryption_key "$key_file"
    fi

    # Encrypt and store secret
    local encrypted_secret=$(encrypt_secret "$secret_value" "$key_file")
    echo "$encrypted_secret" > "$secret_file"
    chmod 600 "$secret_file"

    # Create metadata
    cat > "$metadata_file" <<EOF
{
    "name": "$secret_name",
    "category": "$category",
    "created_by": "$user",
    "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "last_rotated": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "rotation_interval": ${ROTATION_INTERVALS[$category]:-90},
    "hash": "$(echo -n "$secret_value" | sha256sum | cut -d' ' -f1)"
}
EOF
    chmod 600 "$metadata_file"

    log_audit "CREATE" "$secret_name" "$user" "SUCCESS"
    log_message "INFO" "Created secret: $secret_name (category: $category)"
}

# Read secret
read_secret() {
    local secret_name="$1"
    local user="${2:-system}"

    local secret_file="$SECRETS_DIR/$secret_name"
    local key_file="$SECRETS_DIR/.$secret_name.key"

    if [[ ! -f "$secret_file" || ! -f "$key_file" ]]; then
        log_audit "READ" "$secret_name" "$user" "FAILED_NOT_FOUND"
        return 1
    fi

    local encrypted_secret=$(cat "$secret_file")
    local decrypted_secret=$(decrypt_secret "$encrypted_secret" "$key_file")

    log_audit "READ" "$secret_name" "$user" "SUCCESS"
    echo "$decrypted_secret"
}

# Update secret
update_secret() {
    local secret_name="$1"
    local new_value="$2"
    local user="${3:-system}"

    local secret_file="$SECRETS_DIR/$secret_name"
    local key_file="$SECRETS_DIR/.$secret_name.key"
    local metadata_file="$SECRETS_DIR/.$secret_name.metadata"

    if [[ ! -f "$secret_file" ]]; then
        log_audit "UPDATE" "$secret_name" "$user" "FAILED_NOT_FOUND"
        return 1
    fi

    # Backup current secret
    backup_secret "$secret_name"

    # Get old hash for rotation logging
    local old_hash=$(jq -r '.hash' "$metadata_file" 2>/dev/null || echo "unknown")

    # Encrypt and update secret
    local encrypted_secret=$(encrypt_secret "$new_value" "$key_file")
    echo "$encrypted_secret" > "$secret_file"

    # Update metadata
    local new_hash=$(echo -n "$new_value" | sha256sum | cut -d' ' -f1)
    jq --arg hash "$new_hash" --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
       '.hash = $hash | .last_rotated = $timestamp' \
       "$metadata_file" > "$metadata_file.tmp" && mv "$metadata_file.tmp" "$metadata_file"

    log_audit "UPDATE" "$secret_name" "$user" "SUCCESS"
    log_rotation "$secret_name" "$old_hash" "$new_hash"
    log_message "INFO" "Updated secret: $secret_name"
}

# Delete secret
delete_secret() {
    local secret_name="$1"
    local user="${2:-system}"

    local secret_file="$SECRETS_DIR/$secret_name"
    local key_file="$SECRETS_DIR/.$secret_name.key"
    local metadata_file="$SECRETS_DIR/.$secret_name.metadata"

    if [[ ! -f "$secret_file" ]]; then
        log_audit "DELETE" "$secret_name" "$user" "FAILED_NOT_FOUND"
        return 1
    fi

    # Backup before deletion
    backup_secret "$secret_name"

    # Securely delete files
    shred -vfz -n 3 "$secret_file" "$key_file" "$metadata_file" 2>/dev/null || {
        rm -f "$secret_file" "$key_file" "$metadata_file"
    }

    log_audit "DELETE" "$secret_name" "$user" "SUCCESS"
    log_message "INFO" "Deleted secret: $secret_name"
}

# List secrets
list_secrets() {
    local user="${1:-system}"

    log_audit "LIST" "ALL" "$user" "SUCCESS"

    echo "Available secrets:"
    for metadata_file in "$SECRETS_DIR"/.*.metadata; do
        if [[ -f "$metadata_file" ]]; then
            local secret_name=$(jq -r '.name' "$metadata_file")
            local category=$(jq -r '.category' "$metadata_file")
            local created_at=$(jq -r '.created_at' "$metadata_file")
            local last_rotated=$(jq -r '.last_rotated' "$metadata_file")

            echo "  $secret_name ($category) - Created: $created_at, Last rotated: $last_rotated"
        fi
    done
}

# Backup secret
backup_secret() {
    local secret_name="$1"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_dir="$SECRETS_BACKUP_DIR/$timestamp"

    mkdir -p "$backup_dir"

    # Copy secret files to backup
    cp "$SECRETS_DIR/$secret_name" "$backup_dir/" 2>/dev/null || true
    cp "$SECRETS_DIR/.$secret_name.key" "$backup_dir/" 2>/dev/null || true
    cp "$SECRETS_DIR/.$secret_name.metadata" "$backup_dir/" 2>/dev/null || true

    log_message "INFO" "Backed up secret: $secret_name to $backup_dir"
}

# Rotate secret
rotate_secret() {
    local secret_name="$1"
    local user="${2:-system}"

    local metadata_file="$SECRETS_DIR/.$secret_name.metadata"

    if [[ ! -f "$metadata_file" ]]; then
        log_audit "ROTATE" "$secret_name" "$user" "FAILED_NOT_FOUND"
        return 1
    fi

    local category=$(jq -r '.category' "$metadata_file")
    local new_value

    # Generate new secret based on category
    case "$category" in
        "database")
            new_value=$(generate_password 32)
            ;;
        "redis")
            new_value=$(generate_password 24)
            ;;
        "jwt")
            new_value=$(generate_jwt_secret 64)
            ;;
        "api_keys")
            new_value=$(generate_api_key "sk" 48)
            ;;
        "encryption_keys")
            new_value=$(generate_jwt_secret 32)
            ;;
        *)
            new_value=$(generate_password 32)
            ;;
    esac

    # Update secret with new value
    update_secret "$secret_name" "$new_value" "$user"

    log_audit "ROTATE" "$secret_name" "$user" "SUCCESS"
    send_alert "INFO" "Rotated secret: $secret_name"
}

# Check if secret needs rotation
needs_rotation() {
    local secret_name="$1"
    local metadata_file="$SECRETS_DIR/.$secret_name.metadata"

    if [[ ! -f "$metadata_file" ]]; then
        return 1
    fi

    local last_rotated=$(jq -r '.last_rotated' "$metadata_file")
    local rotation_interval=$(jq -r '.rotation_interval' "$metadata_file")

    local last_rotated_timestamp=$(date -d "$last_rotated" +%s)
    local current_timestamp=$(date +%s)
    local rotation_interval_seconds=$((rotation_interval * 24 * 60 * 60))

    if (( current_timestamp - last_rotated_timestamp > rotation_interval_seconds )); then
        return 0
    else
        return 1
    fi
}

# Auto-rotate secrets
auto_rotate_secrets() {
    log_message "INFO" "Starting automatic secret rotation check"

    for metadata_file in "$SECRETS_DIR"/.*.metadata; do
        if [[ -f "$metadata_file" ]]; then
            local secret_name=$(jq -r '.name' "$metadata_file")

            if needs_rotation "$secret_name"; then
                log_message "INFO" "Secret $secret_name needs rotation"
                rotate_secret "$secret_name" "auto-rotation"
            fi
        fi
    done

    log_message "INFO" "Completed automatic secret rotation check"
}

# Inject secret into container
inject_secret() {
    local container_name="$1"
    local secret_name="$2"
    local env_var_name="$3"
    local user="${4:-system}"

    local secret_value=$(read_secret "$secret_name" "$user")

    if [[ -z "$secret_value" ]]; then
        log_audit "INJECT" "$secret_name" "$user" "FAILED_READ_ERROR"
        return 1
    fi

    # Create temporary file for secret
    local temp_file=$(mktemp)
    echo "$secret_value" > "$temp_file"
    chmod 600 "$temp_file"

    # Copy secret to container
    docker cp "$temp_file" "$container_name:/tmp/secret_$secret_name"

    # Set environment variable in container
    docker exec "$container_name" bash -c "export $env_var_name=\$(cat /tmp/secret_$secret_name); rm -f /tmp/secret_$secret_name"

    # Clean up temporary file
    shred -vfz -n 3 "$temp_file" 2>/dev/null || rm -f "$temp_file"

    log_audit "INJECT" "$secret_name" "$user" "SUCCESS"
    log_message "INFO" "Injected secret $secret_name into container $container_name as $env_var_name"
}

# Create Docker secret
create_docker_secret() {
    local secret_name="$1"
    local secret_value="$2"
    local user="${3:-system}"

    # Create Docker secret
    echo "$secret_value" | docker secret create "$secret_name" - 2>/dev/null || {
        log_audit "CREATE_DOCKER_SECRET" "$secret_name" "$user" "FAILED"
        return 1
    }

    log_audit "CREATE_DOCKER_SECRET" "$secret_name" "$user" "SUCCESS"
    log_message "INFO" "Created Docker secret: $secret_name"
}

# Initialize default secrets
initialize_secrets() {
    log_message "INFO" "Initializing default secrets"

    # Database secrets
    if [[ ! -f "$SECRETS_DIR/postgres_password" ]]; then
        create_secret "postgres_password" "$(generate_password 32)" "database" "init"
    fi

    if [[ ! -f "$SECRETS_DIR/postgres_user" ]]; then
        create_secret "postgres_user" "sovren" "database" "init"
    fi

    # Redis secrets
    if [[ ! -f "$SECRETS_DIR/redis_password" ]]; then
        create_secret "redis_password" "$(generate_password 24)" "redis" "init"
    fi

    # JWT secrets
    if [[ ! -f "$SECRETS_DIR/jwt_secret" ]]; then
        create_secret "jwt_secret" "$(generate_jwt_secret 64)" "jwt" "init"
    fi

    # API keys
    if [[ ! -f "$SECRETS_DIR/api_key" ]]; then
        create_secret "api_key" "$(generate_api_key "sk" 48)" "api_keys" "init"
    fi

    # Encryption keys
    if [[ ! -f "$SECRETS_DIR/encryption_key" ]]; then
        create_secret "encryption_key" "$(generate_jwt_secret 32)" "encryption_keys" "init"
    fi

    log_message "INFO" "Completed default secret initialization"
}

# Generate secret report
generate_report() {
    local report_file="/var/log/sovren/secret-report-$(date +%Y%m%d-%H%M%S).json"

    local total_secrets=0
    local expired_secrets=0
    local secrets_by_category=()

    # Count secrets and check expiration
    for metadata_file in "$SECRETS_DIR"/.*.metadata; do
        if [[ -f "$metadata_file" ]]; then
            ((total_secrets++))

            local secret_name=$(jq -r '.name' "$metadata_file")
            local category=$(jq -r '.category' "$metadata_file")

            if needs_rotation "$secret_name"; then
                ((expired_secrets++))
            fi

            secrets_by_category["$category"]=$((${secrets_by_category["$category"]:-0} + 1))
        fi
    done

    # Generate report
    local report=$(cat <<EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "hostname": "$(hostname)",
    "total_secrets": $total_secrets,
    "expired_secrets": $expired_secrets,
    "secrets_by_category": $(printf '%s\n' "${secrets_by_category[@]}" | jq -R . | jq -s 'add'),
    "recent_actions": $(tail -10 "$AUDIT_LOG" | jq -R . | jq -s .),
    "health_status": "$([ $expired_secrets -eq 0 ] && echo "healthy" || echo "needs_attention")"
}
EOF
)

    echo "$report" > "$report_file"
    log_message "INFO" "Generated secret report: $report_file"
}

# Main function
main() {
    case "${1:-}" in
        "init")
            initialize_secrets
            ;;
        "create")
            create_secret "$2" "$3" "${4:-general}" "${5:-system}"
            ;;
        "read")
            read_secret "$2" "${3:-system}"
            ;;
        "update")
            update_secret "$2" "$3" "${4:-system}"
            ;;
        "delete")
            delete_secret "$2" "${3:-system}"
            ;;
        "list")
            list_secrets "${2:-system}"
            ;;
        "rotate")
            rotate_secret "$2" "${3:-system}"
            ;;
        "auto-rotate")
            auto_rotate_secrets
            ;;
        "inject")
            inject_secret "$2" "$3" "$4" "${5:-system}"
            ;;
        "docker-secret")
            create_docker_secret "$2" "$3" "${4:-system}"
            ;;
        "report")
            generate_report
            ;;
        "daemon")
            # Run in daemon mode for automatic rotation
            while true; do
                auto_rotate_secrets
                sleep 3600  # Check every hour
            done
            ;;
        *)
            echo "Usage: $0 {init|create|read|update|delete|list|rotate|auto-rotate|inject|docker-secret|report|daemon}"
            echo ""
            echo "Commands:"
            echo "  init                               Initialize default secrets"
            echo "  create <name> <value> [category]   Create a new secret"
            echo "  read <name>                        Read a secret"
            echo "  update <name> <value>              Update a secret"
            echo "  delete <name>                      Delete a secret"
            echo "  list                               List all secrets"
            echo "  rotate <name>                      Rotate a secret"
            echo "  auto-rotate                        Auto-rotate expired secrets"
            echo "  inject <container> <secret> <env>  Inject secret into container"
            echo "  docker-secret <name> <value>       Create Docker secret"
            echo "  report                             Generate secret report"
            echo "  daemon                             Run in daemon mode"
            exit 1
            ;;
    esac
}

# Check dependencies
if ! command -v jq >/dev/null 2>&1; then
    echo "Error: jq is required but not installed" >&2
    exit 1
fi

if ! command -v openssl >/dev/null 2>&1; then
    echo "Error: openssl is required but not installed" >&2
    exit 1
fi

# Run main function
main "$@"
