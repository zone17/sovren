#!/usr/bin/env bash
# CE Metrics — Session End Hook (sync, timeout: 60s)
# Aggregates session metrics from ce-events.jsonl and pushes to Pushgateway
# Emits ~20 metrics across 5 dimensions: Cost, Velocity, Quality, Knowledge, Agent Efficiency

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

ce_init

[ "$session_id" != "unknown" ] || exit 0
[ -f "$CE_EVENTS_FILE" ] || exit 0

# ── Single-pass JSONL aggregation ──────────────────────────────────────────
aggregates=$(jq -s --arg sid "$session_id" '
  [.[] | select(.session_id == $sid)] |
  {
    # Velocity
    total_turns: [.[] | select(.type == "turn_complete")] | length,
    total_events: length,
    adhoc_events: [.[] | select(.phase == "adhoc")] | length,

    # Agent Efficiency
    total_agents: [.[] | select(.type == "agent_spawn")] | length,
    total_tasks: [.[] | select(.type == "task_complete")] | length,
    total_commits: [.[] | select(.type == "git_commit")] | length,
    agent_durations: [.[] | select(.type == "agent_complete") | .duration_seconds // 0],

    # Cost — token breakdown by type
    total_input_tokens: [.[] | select(.type == "turn_complete") | .input_tokens // 0] | add // 0,
    total_output_tokens: [.[] | select(.type == "turn_complete") | .output_tokens // 0] | add // 0,
    total_cache_read_tokens: [.[] | select(.type == "turn_complete") | .cache_read_tokens // 0] | add // 0,
    total_cache_creation_tokens: [.[] | select(.type == "turn_complete") | .cache_creation_tokens // 0] | add // 0,

    # Cost — per-model breakdown
    tokens_by_model: (
      [.[] | select(.type == "turn_complete")] |
      group_by(.model // "unknown") |
      map({
        model: (.[0].model // "unknown"),
        input: ([.[].input_tokens // 0] | add // 0),
        output: ([.[].output_tokens // 0] | add // 0)
      })
    ),

    # Velocity — phase durations from phase transitions
    phase_events: [.[] | select(.type == "turn_complete") | {phase: .phase, ts: .timestamp}],

    # Quality — review findings
    findings_p1: [.[] | select(.type == "review_findings") | .p1 // 0] | add // 0,
    findings_p2: [.[] | select(.type == "review_findings") | .p2 // 0] | add // 0,
    findings_p3: [.[] | select(.type == "review_findings") | .p3 // 0] | add // 0
  }
' "$CE_EVENTS_FILE" 2>/dev/null)

[ -n "$aggregates" ] || exit 0

# ── Extract values ─────────────────────────────────────────────────────────
total_turns=$(echo "$aggregates" | jq -r '.total_turns')
total_agents=$(echo "$aggregates" | jq -r '.total_agents')
total_tasks=$(echo "$aggregates" | jq -r '.total_tasks')
total_commits=$(echo "$aggregates" | jq -r '.total_commits')
total_input_tokens=$(echo "$aggregates" | jq -r '.total_input_tokens')
total_output_tokens=$(echo "$aggregates" | jq -r '.total_output_tokens')
total_cache_read=$(echo "$aggregates" | jq -r '.total_cache_read_tokens')
total_cache_creation=$(echo "$aggregates" | jq -r '.total_cache_creation_tokens')
total_events=$(echo "$aggregates" | jq -r '.total_events')
adhoc_events=$(echo "$aggregates" | jq -r '.adhoc_events')
findings_p1=$(echo "$aggregates" | jq -r '.findings_p1')
findings_p2=$(echo "$aggregates" | jq -r '.findings_p2')
findings_p3=$(echo "$aggregates" | jq -r '.findings_p3')

# Agent duration average
agent_dur_avg=$(echo "$aggregates" | jq -r '
  if (.agent_durations | length) > 0
  then (.agent_durations | add / length | . * 100 | round / 100)
  else 0
  end')

# ── Labels ─────────────────────────────────────────────────────────────────
session_short=$(sanitize_label "${session_id:0:8}")
phase=$(sanitize_label "$(get_phase)")
project=$(sanitize_label "$(get_project)")
pr_number=$(jq -r '.pr_number // 0' "$CE_PHASE_FILE" 2>/dev/null || echo "0")

# ── Multi-model cost ──────────────────────────────────────────────────────
cost=$(compute_cost "$CE_EVENTS_FILE" "$session_id")

# ── Lines changed ─────────────────────────────────────────────────────────
read -r lines_added lines_deleted < <(get_lines_changed)

# ── Knowledge counts ──────────────────────────────────────────────────────
read -r compound_docs pattern_count < <(get_knowledge_counts)

# ── Phase validation ──────────────────────────────────────────────────────
if [ "$total_events" -gt 5 ] && [ "$adhoc_events" -gt 0 ]; then
  adhoc_pct=$((adhoc_events * 100 / total_events))
  if [ "$adhoc_pct" -gt 90 ]; then
    echo "WARNING: $adhoc_pct% of events tagged 'adhoc' — CE phase detection may not be working" >&2
  fi
fi

# ── Build Prometheus metrics ──────────────────────────────────────────────
metrics="# CE Session Summary — 5 Dimensions

# ═══ COST EFFICIENCY ═══
# HELP ce_session_cost_usd Estimated session cost in USD (multi-model pricing)
# TYPE ce_session_cost_usd gauge
ce_session_cost_usd{session=\"$session_short\",phase=\"$phase\",project=\"$project\",pr_number=\"$pr_number\"} $cost

# HELP ce_session_tokens_total Total tokens used in session by type
# TYPE ce_session_tokens_total gauge
ce_session_tokens_total{type=\"input\",session=\"$session_short\",phase=\"$phase\",project=\"$project\",pr_number=\"$pr_number\"} $total_input_tokens
ce_session_tokens_total{type=\"output\",session=\"$session_short\",phase=\"$phase\",project=\"$project\",pr_number=\"$pr_number\"} $total_output_tokens
ce_session_tokens_total{type=\"cache_read\",session=\"$session_short\",phase=\"$phase\",project=\"$project\",pr_number=\"$pr_number\"} $total_cache_read
ce_session_tokens_total{type=\"cache_creation\",session=\"$session_short\",phase=\"$phase\",project=\"$project\",pr_number=\"$pr_number\"} $total_cache_creation
"

# Per-model token breakdown
model_metrics=$(echo "$aggregates" | jq -r --arg s "$session_short" --arg ph "$phase" --arg proj "$project" --arg pr "$pr_number" '
  .tokens_by_model[] |
  "ce_session_tokens_by_model{model=\"\(.model)\",type=\"input\",session=\"\($s)\",phase=\"\($ph)\",project=\"\($proj)\",pr_number=\"\($pr)\"} \(.input)\nce_session_tokens_by_model{model=\"\(.model)\",type=\"output\",session=\"\($s)\",phase=\"\($ph)\",project=\"\($proj)\",pr_number=\"\($pr)\"} \(.output)"
' 2>/dev/null || echo "")

if [ -n "$model_metrics" ]; then
  metrics+="# HELP ce_session_tokens_by_model Token usage per model
# TYPE ce_session_tokens_by_model gauge
$model_metrics
"
fi

metrics+="
# ═══ VELOCITY ═══
# HELP ce_session_turns_total Total turns in session
# TYPE ce_session_turns_total gauge
ce_session_turns_total{session=\"$session_short\",phase=\"$phase\",project=\"$project\",pr_number=\"$pr_number\"} $total_turns

# ═══ QUALITY ═══
# HELP ce_findings_total Review findings by severity
# TYPE ce_findings_total gauge
ce_findings_total{severity=\"p1\",session=\"$session_short\",phase=\"$phase\",project=\"$project\",pr_number=\"$pr_number\"} $findings_p1
ce_findings_total{severity=\"p2\",session=\"$session_short\",phase=\"$phase\",project=\"$project\",pr_number=\"$pr_number\"} $findings_p2
ce_findings_total{severity=\"p3\",session=\"$session_short\",phase=\"$phase\",project=\"$project\",pr_number=\"$pr_number\"} $findings_p3

# HELP ce_lines_changed Lines changed vs origin/main
# TYPE ce_lines_changed gauge
ce_lines_changed{type=\"added\",session=\"$session_short\",phase=\"$phase\",project=\"$project\",pr_number=\"$pr_number\"} ${lines_added:-0}
ce_lines_changed{type=\"deleted\",session=\"$session_short\",phase=\"$phase\",project=\"$project\",pr_number=\"$pr_number\"} ${lines_deleted:-0}

# ═══ KNOWLEDGE COMPOUNDING ═══
# HELP ce_compound_docs_total Count of compound docs in docs/solutions/
# TYPE ce_compound_docs_total gauge
ce_compound_docs_total{project=\"$project\"} ${compound_docs:-0}

# HELP ce_pattern_count Lines in common-solutions.md (pattern density proxy)
# TYPE ce_pattern_count gauge
ce_pattern_count{project=\"$project\"} ${pattern_count:-0}

# ═══ AGENT EFFICIENCY ═══
# HELP ce_session_agents_total Total agents spawned in session
# TYPE ce_session_agents_total gauge
ce_session_agents_total{session=\"$session_short\",phase=\"$phase\",project=\"$project\",pr_number=\"$pr_number\"} $total_agents

# HELP ce_session_tasks_total Total tasks completed in session
# TYPE ce_session_tasks_total gauge
ce_session_tasks_total{session=\"$session_short\",phase=\"$phase\",project=\"$project\",pr_number=\"$pr_number\"} $total_tasks

# HELP ce_session_commits_total Total commits in session
# TYPE ce_session_commits_total gauge
ce_session_commits_total{session=\"$session_short\",phase=\"$phase\",project=\"$project\",pr_number=\"$pr_number\"} $total_commits

# HELP ce_agent_duration_seconds_avg Average agent completion time in seconds
# TYPE ce_agent_duration_seconds_avg gauge
ce_agent_duration_seconds_avg{session=\"$session_short\",phase=\"$phase\",project=\"$project\",pr_number=\"$pr_number\"} $agent_dur_avg
"

# ── Push to Pushgateway ───────────────────────────────────────────────────
push_to_gateway "ce_session" "$session_short" "$metrics"

# Clean up previous session's stale metrics
prev_session=$(jq -r '.session_id // ""' "$CE_PHASE_FILE" 2>/dev/null || echo "")
if [ -n "$prev_session" ] && [ "$prev_session" != "$session_id" ]; then
  cleanup_stale_session "$(sanitize_label "${prev_session:0:8}")"
fi
