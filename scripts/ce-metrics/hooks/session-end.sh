#!/usr/bin/env bash
# CE Metrics — Session End Hook (sync, timeout: 60s)
# Aggregates session metrics from ce-events.jsonl and pushes to Pushgateway
# P1 FIX: Reads from JSONL (~140KB) NOT transcript (up to 723MB)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

ce_check_disabled

# Read input JSON from stdin
input=$(cat)
session_id=$(echo "$input" | jq -r '.session_id // "unknown"' 2>/dev/null || echo "unknown")

[ "$session_id" != "unknown" ] || exit 0
[ -f "$CE_EVENTS_FILE" ] || exit 0

# Aggregate session events from JSONL (structured query, not grep)
session_events=$(jq -c "select(.session_id == \"$session_id\")" "$CE_EVENTS_FILE" 2>/dev/null)
[ -n "$session_events" ] || exit 0

# Count event types
total_turns=$(echo "$session_events" | jq -c 'select(.type == "turn_complete")' | wc -l | tr -d ' ')
total_agents=$(echo "$session_events" | jq -c 'select(.type == "agent_spawn")' | wc -l | tr -d ' ')
total_tasks=$(echo "$session_events" | jq -c 'select(.type == "task_complete")' | wc -l | tr -d ' ')
total_commits=$(echo "$session_events" | jq -c 'select(.type == "git_commit")' | wc -l | tr -d ' ')

# Sum tokens
total_input_tokens=$(echo "$session_events" | jq -c 'select(.type == "turn_complete")' | jq -s '[.[].input_tokens // 0] | add // 0' 2>/dev/null || echo 0)
total_output_tokens=$(echo "$session_events" | jq -c 'select(.type == "turn_complete")' | jq -s '[.[].output_tokens // 0] | add // 0' 2>/dev/null || echo 0)

# Get session metadata
phase=$(get_phase)
project=$(get_project)
# branch available for future label use
session_short="${session_id:0:8}"

# Phase validation: warn if >90% events are "adhoc" but CE skills were invoked
total_events=$(echo "$session_events" | wc -l | tr -d ' ')
adhoc_events=$(echo "$session_events" | jq -c 'select(.phase == "adhoc")' | wc -l | tr -d ' ')
if [ "$total_events" -gt 5 ] && [ "$adhoc_events" -gt 0 ]; then
  adhoc_pct=$((adhoc_events * 100 / total_events))
  if [ "$adhoc_pct" -gt 90 ]; then
    echo "WARNING: $adhoc_pct% of events tagged 'adhoc' — CE phase detection may not be working" >&2
  fi
fi

# Build Prometheus metrics in text format
metrics="# CE Session Summary
# HELP ce_session_cost_usd Estimated session cost in USD
# TYPE ce_session_cost_usd gauge
# HELP ce_session_tokens_total Total tokens used in session
# TYPE ce_session_tokens_total gauge
# HELP ce_session_turns_total Total turns in session
# TYPE ce_session_turns_total gauge
# HELP ce_session_agents_total Total agents spawned in session
# TYPE ce_session_agents_total gauge
# HELP ce_session_tasks_total Total tasks completed in session
# TYPE ce_session_tasks_total gauge
# HELP ce_session_commits_total Total commits in session
# TYPE ce_session_commits_total gauge

ce_session_tokens_total{type=\"input\",session=\"$session_short\",phase=\"$phase\",project=\"$project\"} $total_input_tokens
ce_session_tokens_total{type=\"output\",session=\"$session_short\",phase=\"$phase\",project=\"$project\"} $total_output_tokens
ce_session_turns_total{session=\"$session_short\",phase=\"$phase\",project=\"$project\"} $total_turns
ce_session_agents_total{session=\"$session_short\",phase=\"$phase\",project=\"$project\"} $total_agents
ce_session_tasks_total{session=\"$session_short\",phase=\"$phase\",project=\"$project\"} $total_tasks
ce_session_commits_total{session=\"$session_short\",phase=\"$phase\",project=\"$project\"} $total_commits
"

# Push to Pushgateway
push_to_gateway "ce_session" "$session_short" "$metrics"

# Clean up previous session's stale metrics
prev_session=$(jq -r '.session_id // ""' "$CE_PHASE_FILE" 2>/dev/null || echo "")
if [ -n "$prev_session" ] && [ "$prev_session" != "$session_id" ]; then
  cleanup_stale_session "${prev_session:0:8}"
fi
