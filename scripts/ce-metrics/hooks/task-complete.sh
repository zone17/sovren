#!/usr/bin/env bash
# CE Metrics — Task Complete Hook (async, timeout: 5s)
# Tracks task resolution for team efficiency metrics

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

ce_check_disabled

# Read input JSON from stdin
input=$(cat)
session_id=$(echo "$input" | jq -r '.session_id // "unknown"' 2>/dev/null || echo "unknown")
task_id=$(echo "$input" | jq -r '.task_id // "unknown"' 2>/dev/null || echo "unknown")
task_subject=$(echo "$input" | jq -r '.task_subject // ""' 2>/dev/null || echo "")
team_name=$(echo "$input" | jq -r '.team_name // ""' 2>/dev/null || echo "")

# Sanitize task subject to remove potential secrets
safe_subject=$(sanitize_subject "$task_subject")

emit_event "task_complete" \
  "$(jq -cn \
    --arg tid "$task_id" \
    --arg subj "$safe_subject" \
    --arg team "$team_name" \
    '{task_id: $tid, task_subject: $subj, team_name: $team}')" \
  "$session_id"
