#!/usr/bin/env bash
# CE Metrics — Task Complete Hook (async, timeout: 5s)
# Tracks task resolution for team efficiency metrics

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

ce_init

task_id=$(ce_get_field "$input" ".task_id" "unknown")
task_subject=$(ce_get_field "$input" ".task_subject" "")
team_name=$(ce_get_field "$input" ".team_name" "")

# Sanitize task subject to remove potential secrets
safe_subject=$(sanitize_subject "$task_subject")

emit_event "task_complete" \
  "$(jq -cn \
    --arg tid "$task_id" \
    --arg subj "$safe_subject" \
    --arg team "$team_name" \
    '{task_id: $tid, task_subject: $subj, team_name: $team}')" \
  "$session_id"
