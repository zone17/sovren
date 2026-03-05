#!/usr/bin/env bash
# CE Metrics — Shared Library
# All hook scripts source this file for common functions

set -euo pipefail

CE_METRICS_DIR="$HOME/.claude/metrics"
CE_EVENTS_FILE="$CE_METRICS_DIR/ce-events.jsonl"
CE_PHASE_FILE="$CE_METRICS_DIR/ce-phase.json"
CE_PENDING_DIR="$CE_METRICS_DIR/pending"
PUSHGATEWAY_URL="http://localhost:9091"

# Disable check — exit silently if metrics disabled
ce_check_disabled() {
  [ -f "$CE_METRICS_DIR/.disabled" ] && exit 0 || true
}

# Ensure metrics directory exists
ce_ensure_dirs() {
  mkdir -p "$CE_METRICS_DIR" "$CE_PENDING_DIR"
}

# Get current CE phase from phase file
get_phase() {
  if command -v jq &>/dev/null && [ -f "$CE_PHASE_FILE" ]; then
    jq -r '.phase // "adhoc"' "$CE_PHASE_FILE" 2>/dev/null || echo "adhoc"
  elif command -v python3 &>/dev/null && [ -f "$CE_PHASE_FILE" ]; then
    python3 -c "import json; print(json.load(open('$CE_PHASE_FILE')).get('phase','adhoc'))" 2>/dev/null || echo "adhoc"
  else
    echo "adhoc"
  fi
}

# Get project name from git root basename
get_project() {
  local git_root
  git_root=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
  if [ -n "$git_root" ]; then
    basename "$git_root"
  else
    echo "unknown"
  fi
}

# Get current branch
get_branch() {
  git branch --show-current 2>/dev/null || echo "unknown"
}

# Emit a JSON event to the JSONL events file
# Usage: emit_event "event_type" '{"key":"value",...}'
emit_event() {
  local event_type="$1"
  local extra_json="${2:-{\}}"
  local session_id="${3:-unknown}"
  local timestamp
  timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  local phase
  phase=$(get_phase)
  local project
  project=$(get_project)

  # Build the JSON line — merge extra_json into base event
  local json
  if command -v jq &>/dev/null; then
    json=$(jq -cn \
      --arg type "$event_type" \
      --arg ts "$timestamp" \
      --arg sid "$session_id" \
      --arg phase "$phase" \
      --arg project "$project" \
      --argjson extra "$extra_json" \
      '{type: $type, timestamp: $ts, session_id: $sid, phase: $phase, project: $project} + $extra')
  else
    # Fallback: simple string concat (no special chars in our data)
    json="{\"type\":\"$event_type\",\"timestamp\":\"$timestamp\",\"session_id\":\"$session_id\",\"phase\":\"$phase\",\"project\":\"$project\"}"
  fi

  ce_ensure_dirs
  { printf '%s\n' "$json"; } >> "$CE_EVENTS_FILE"
}

# Parse last turn tokens from transcript using tail (O(1) seek, not O(n) read)
# Returns JSON with token counts or empty string on failure
parse_last_turn_tokens() {
  local transcript_path="$1"
  [ -f "$transcript_path" ] || return 0

  # Get the last line of the transcript (JSONL format)
  local last_line
  last_line=$(tail -1 "$transcript_path" 2>/dev/null) || return 0
  [ -n "$last_line" ] || return 0

  # Extract token usage from the last turn
  if command -v jq &>/dev/null; then
    echo "$last_line" | jq -c '{
      input_tokens: (.usage.input_tokens // 0),
      output_tokens: (.usage.output_tokens // 0),
      cache_read_tokens: (.usage.cache_read_input_tokens // 0),
      cache_creation_tokens: (.usage.cache_creation_input_tokens // 0),
      model: (.model // "unknown")
    }' 2>/dev/null || echo ""
  else
    echo ""
  fi
}

# Classify git commands — reads ONLY the first 2 words, NEVER stores full command
# Returns: git_commit, git_push, pr_create, pr_merge, or empty string
classify_git_command() {
  local cmd_prefix="$1"
  case "$cmd_prefix" in
    "git commit"*)   echo "git_commit" ;;
    "git push"*)     echo "git_push" ;;
    "gh pr create"*) echo "pr_create" ;;
    "gh pr merge"*)  echo "pr_merge" ;;
    *)               echo "" ;;
  esac
}

# Sanitize task subject — strip anything that looks like a secret
sanitize_subject() {
  local subject="$1"
  # Remove anything after common secret patterns
  echo "$subject" | sed -E \
    -e 's/(key|token|password|secret|credential)[=: ]+[^ ]*/\1=REDACTED/gi' \
    -e 's/[A-Za-z0-9+/]{40,}/REDACTED/g'
}

# Push metrics to Pushgateway with retry/pending mechanism
push_to_gateway() {
  local job="$1"
  local instance="${2:-}"
  local metrics_data="$3"

  local url="$PUSHGATEWAY_URL/metrics/job/$job"
  [ -n "$instance" ] && url="$url/instance/$instance"

  if echo "$metrics_data" | curl --connect-timeout 2 --max-time 5 --fail --silent \
    --data-binary @- "$url" 2>/dev/null; then
    # Success — try to replay any pending payloads
    replay_pending
    return 0
  else
    # Failed — save to pending directory for later replay
    local pending_file
    pending_file="$CE_PENDING_DIR/$(date +%s)-$job.prom"
    echo "$metrics_data" > "$pending_file"
    echo "url=$url" >> "$pending_file.meta"
    return 1
  fi
}

# Replay pending pushgateway payloads
replay_pending() {
  [ -d "$CE_PENDING_DIR" ] || return 0
  local pending_files
  pending_files=$(find "$CE_PENDING_DIR" -name "*.prom" -type f 2>/dev/null) || return 0
  [ -n "$pending_files" ] || return 0

  while IFS= read -r pfile; do
    [ -f "$pfile" ] || continue
    local meta_file="$pfile.meta"
    [ -f "$meta_file" ] || continue
    local url
    url=$(grep "^url=" "$meta_file" | cut -d= -f2-)
    [ -n "$url" ] || continue

    if curl --connect-timeout 2 --max-time 5 --fail --silent \
      --data-binary @"$pfile" "$url" 2>/dev/null; then
      rm -f "$pfile" "$meta_file"
    fi
  done <<< "$pending_files"
}

# Delete stale session metrics from pushgateway
cleanup_stale_session() {
  local prev_session_id="$1"
  [ -n "$prev_session_id" ] || return 0
  curl -s --connect-timeout 2 --max-time 5 \
    -X DELETE "$PUSHGATEWAY_URL/metrics/job/ce_session/instance/$prev_session_id" 2>/dev/null || true
}

# JSONL rotation — move to .jsonl.1 if > 10MB
rotate_jsonl() {
  [ -f "$CE_EVENTS_FILE" ] || return 0
  local size
  size=$(stat -f%z "$CE_EVENTS_FILE" 2>/dev/null || stat -c%s "$CE_EVENTS_FILE" 2>/dev/null || echo 0)
  if [ "$size" -gt 10485760 ]; then
    mv "$CE_EVENTS_FILE" "${CE_EVENTS_FILE}.1"
  fi
}
