#!/usr/bin/env bash
# CE Metrics — Session Start Hook (sync, timeout: 5s)
# Initializes phase tracking and rotates JSONL if needed

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

ce_init

# Rotate JSONL if needed
rotate_jsonl

# Write initial phase file
branch=$(get_branch)
started_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)

jq -n \
  --arg sid "$session_id" \
  --arg phase "adhoc" \
  --arg started "$started_at" \
  --arg branch "$branch" \
  '{session_id: $sid, phase: $phase, started_at: $started, branch: $branch}' \
  > "$CE_PHASE_FILE"

# Resolve and cache PR number (non-blocking, best-effort)
pr_number=$(get_pr_number 2>/dev/null || echo "0")

emit_event "session_start" \
  "$(jq -cn --argjson pr "${pr_number:-0}" '{pr_number: $pr}')" \
  "$session_id"
