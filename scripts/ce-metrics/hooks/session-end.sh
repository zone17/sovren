#!/usr/bin/env bash
# CE Metrics — Session End Hook (sync, timeout: 60s)
# Aggregates session metrics from transcript + JSONL and pushes to Pushgateway
# Emits ~20 metrics across 5 dimensions: Cost, Velocity, Quality, Knowledge, Agent Efficiency

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

ce_init

[ "$session_id" != "unknown" ] || exit 0

# ── Get transcript path from hook input ────────────────────────────────────
transcript_path=$(ce_get_field "$input" ".transcript_path" "")

# ── Token data: read directly from transcript (authoritative source) ───────
if [ -n "$transcript_path" ] && [ -f "$transcript_path" ]; then
  token_data=$(aggregate_transcript_tokens "$transcript_path")
  total_input_tokens=$(echo "$token_data" | jq -r '.input_tokens // 0')
  total_output_tokens=$(echo "$token_data" | jq -r '.output_tokens // 0')
  total_cache_read=$(echo "$token_data" | jq -r '.cache_read_tokens // 0')
  total_cache_creation=$(echo "$token_data" | jq -r '.cache_creation_tokens // 0')
  total_turns=$(echo "$token_data" | jq -r '.turns // 0')
  cost=$(compute_cost_from_transcript "$transcript_path")
else
  total_input_tokens=0
  total_output_tokens=0
  total_cache_read=0
  total_cache_creation=0
  total_turns=0
  cost=0
fi

# ── JSONL aggregation: agent/task/commit counts + quality findings ─────────
if [ -f "$CE_EVENTS_FILE" ]; then
  aggregates=$(jq -s --arg sid "$session_id" '
    [.[] | select(.session_id == $sid)] |
    {
      total_events: length,
      adhoc_events: [.[] | select(.phase == "adhoc")] | length,
      total_agents: [.[] | select(.type == "agent_spawn")] | length,
      total_tasks: [.[] | select(.type == "task_complete")] | length,
      total_commits: [.[] | select(.type == "git_commit")] | length,
      agent_durations: [.[] | select(.type == "agent_complete") | .duration_seconds // 0],
      findings_p1: [.[] | select(.type == "review_findings") | .p1 // 0] | add // 0,
      findings_p2: [.[] | select(.type == "review_findings") | .p2 // 0] | add // 0,
      findings_p3: [.[] | select(.type == "review_findings") | .p3 // 0] | add // 0
    }
  ' "$CE_EVENTS_FILE" 2>/dev/null)
fi

total_agents=$(echo "${aggregates:-{}}" | jq -r '.total_agents // 0')
total_tasks=$(echo "${aggregates:-{}}" | jq -r '.total_tasks // 0')
total_commits=$(echo "${aggregates:-{}}" | jq -r '.total_commits // 0')
total_events=$(echo "${aggregates:-{}}" | jq -r '.total_events // 0')
adhoc_events=$(echo "${aggregates:-{}}" | jq -r '.adhoc_events // 0')
findings_p1=$(echo "${aggregates:-{}}" | jq -r '.findings_p1 // 0')
findings_p2=$(echo "${aggregates:-{}}" | jq -r '.findings_p2 // 0')
findings_p3=$(echo "${aggregates:-{}}" | jq -r '.findings_p3 // 0')

# Agent duration average
agent_dur_avg=$(echo "${aggregates:-{}}" | jq -r '
  if (.agent_durations // [] | length) > 0
  then (.agent_durations | add / length | . * 100 | round / 100)
  else 0
  end')

# ── Labels ─────────────────────────────────────────────────────────────────
# Use work slug from git branch (e.g. "business-manager-mvp") as session label
# Falls back to Claude session slug, then hex ID
work_slug=$(get_work_slug)
if [ "$work_slug" = "unknown" ] || [ "$work_slug" = "main" ]; then
  # On main or detached HEAD — try Claude session slug from transcript
  if [ -n "$transcript_path" ] && [ -f "$transcript_path" ]; then
    work_slug=$(python3 -c "
import json
for line in open('$transcript_path'):
    try:
        obj = json.loads(line)
        s = obj.get('slug') or obj.get('sessionSlug')
        if s:
            print(s)
            break
    except: pass
" 2>/dev/null || echo "")
  fi
fi
session_label=$(sanitize_label "${work_slug:-${session_id:0:8}}")
phase=$(sanitize_label "$(get_phase)")
project=$(sanitize_label "$(get_project)")
pr_number=$(jq -r '.pr_number // 0' "$CE_PHASE_FILE" 2>/dev/null || echo "0")
session_date=$(date -u +%Y-%m-%d)

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
ce_session_cost_usd{session=\"$session_label\",phase=\"$phase\",project=\"$project\",pr_number=\"$pr_number\",date=\"$session_date\"} $cost

# HELP ce_session_tokens_total Total tokens used in session by type
# TYPE ce_session_tokens_total gauge
ce_session_tokens_total{type=\"input\",session=\"$session_label\",phase=\"$phase\",project=\"$project\",pr_number=\"$pr_number\",date=\"$session_date\"} $total_input_tokens
ce_session_tokens_total{type=\"output\",session=\"$session_label\",phase=\"$phase\",project=\"$project\",pr_number=\"$pr_number\",date=\"$session_date\"} $total_output_tokens
ce_session_tokens_total{type=\"cache_read\",session=\"$session_label\",phase=\"$phase\",project=\"$project\",pr_number=\"$pr_number\",date=\"$session_date\"} $total_cache_read
ce_session_tokens_total{type=\"cache_creation\",session=\"$session_label\",phase=\"$phase\",project=\"$project\",pr_number=\"$pr_number\",date=\"$session_date\"} $total_cache_creation
"

# Per-model token breakdown (from transcript)
model_metrics=$(echo "${token_data:-{}}" | jq -r --arg s "$session_label" --arg ph "$phase" --arg proj "$project" --arg pr "$pr_number" --arg dt "$session_date" '
  .models // {} | to_entries[] |
  "ce_session_tokens_by_model{model=\"\(.key)\",type=\"input\",session=\"\($s)\",phase=\"\($ph)\",project=\"\($proj)\",pr_number=\"\($pr)\",date=\"\($dt)\"} \(.value.input)\nce_session_tokens_by_model{model=\"\(.key)\",type=\"output\",session=\"\($s)\",phase=\"\($ph)\",project=\"\($proj)\",pr_number=\"\($pr)\",date=\"\($dt)\"} \(.value.output)"
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
ce_session_turns_total{session=\"$session_label\",phase=\"$phase\",project=\"$project\",pr_number=\"$pr_number\",date=\"$session_date\"} $total_turns

# ═══ QUALITY ═══
# HELP ce_findings_total Review findings by severity
# TYPE ce_findings_total gauge
ce_findings_total{severity=\"p1\",session=\"$session_label\",phase=\"$phase\",project=\"$project\",pr_number=\"$pr_number\",date=\"$session_date\"} $findings_p1
ce_findings_total{severity=\"p2\",session=\"$session_label\",phase=\"$phase\",project=\"$project\",pr_number=\"$pr_number\",date=\"$session_date\"} $findings_p2
ce_findings_total{severity=\"p3\",session=\"$session_label\",phase=\"$phase\",project=\"$project\",pr_number=\"$pr_number\",date=\"$session_date\"} $findings_p3

# HELP ce_lines_changed Lines changed vs origin/main
# TYPE ce_lines_changed gauge
ce_lines_changed{type=\"added\",session=\"$session_label\",phase=\"$phase\",project=\"$project\",pr_number=\"$pr_number\",date=\"$session_date\"} ${lines_added:-0}
ce_lines_changed{type=\"deleted\",session=\"$session_label\",phase=\"$phase\",project=\"$project\",pr_number=\"$pr_number\",date=\"$session_date\"} ${lines_deleted:-0}

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
ce_session_agents_total{session=\"$session_label\",phase=\"$phase\",project=\"$project\",pr_number=\"$pr_number\",date=\"$session_date\"} $total_agents

# HELP ce_session_tasks_total Total tasks completed in session
# TYPE ce_session_tasks_total gauge
ce_session_tasks_total{session=\"$session_label\",phase=\"$phase\",project=\"$project\",pr_number=\"$pr_number\",date=\"$session_date\"} $total_tasks

# HELP ce_session_commits_total Total commits in session
# TYPE ce_session_commits_total gauge
ce_session_commits_total{session=\"$session_label\",phase=\"$phase\",project=\"$project\",pr_number=\"$pr_number\",date=\"$session_date\"} $total_commits

# HELP ce_agent_duration_seconds_avg Average agent completion time in seconds
# TYPE ce_agent_duration_seconds_avg gauge
ce_agent_duration_seconds_avg{session=\"$session_label\",phase=\"$phase\",project=\"$project\",pr_number=\"$pr_number\",date=\"$session_date\"} $agent_dur_avg
"

# ── Push to Pushgateway ───────────────────────────────────────────────────
push_to_gateway "ce_session" "$session_label" "$metrics"

# Clean up previous session's stale metrics
prev_session=$(jq -r '.session_id // ""' "$CE_PHASE_FILE" 2>/dev/null || echo "")
if [ -n "$prev_session" ] && [ "$prev_session" != "$session_id" ]; then
  cleanup_stale_session "$(sanitize_label "${prev_session:0:8}")"
fi
