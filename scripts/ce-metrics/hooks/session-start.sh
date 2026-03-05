#!/usr/bin/env bash
# CE Metrics — Session Start Hook (sync, timeout: 5s)
# Initializes phase tracking and rotates JSONL if needed

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

ce_check_disabled
ce_ensure_dirs

# Read input JSON from stdin
input=$(cat)
session_id=$(echo "$input" | jq -r '.session_id // "unknown"' 2>/dev/null || echo "unknown")
# cwd available for future use

# Rotate JSONL if needed
rotate_jsonl

# Write initial phase file
branch=$(get_branch)
started_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)

if command -v jq &>/dev/null; then
  jq -n \
    --arg sid "$session_id" \
    --arg phase "adhoc" \
    --arg started "$started_at" \
    --arg branch "$branch" \
    '{session_id: $sid, phase: $phase, started_at: $started, branch: $branch}' \
    > "$CE_PHASE_FILE"
else
  echo "{\"session_id\":\"$session_id\",\"phase\":\"adhoc\",\"started_at\":\"$started_at\",\"branch\":\"$branch\"}" > "$CE_PHASE_FILE"
fi

emit_event "session_start" "{}" "$session_id"
