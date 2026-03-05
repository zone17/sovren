#!/usr/bin/env bash
# CE Metrics — Seed Test Data
# Pushes synthetic CE metrics to Pushgateway for dashboard verification

set -euo pipefail

PUSHGATEWAY_URL="${PUSHGATEWAY_URL:-http://localhost:9091}"

echo "Seeding CE metrics to Pushgateway at $PUSHGATEWAY_URL..."

# Helper: push metrics with error handling
push_metrics() {
  local job="$1"
  local instance="$2"
  local metrics="$3"

  if echo "$metrics" | curl --connect-timeout 3 --max-time 10 --fail --silent \
    --data-binary @- "$PUSHGATEWAY_URL/metrics/job/$job/instance/$instance" 2>/dev/null; then
    echo "  OK: $job / $instance"
  else
    echo "  SKIP: $job / $instance (Pushgateway unreachable or rejected)"
  fi
}

# ------------------------------------------------------------------
# Session 1: Plan phase, Sovren project
# ------------------------------------------------------------------
push_metrics "ce_session" "sess-abc123" "
# HELP ce_session_tokens_total Total tokens used in session
# TYPE ce_session_tokens_total gauge
ce_session_tokens_total{type=\"input\",session=\"sess-abc1\",phase=\"plan\",project=\"Sovren\"} 45200
ce_session_tokens_total{type=\"output\",session=\"sess-abc1\",phase=\"plan\",project=\"Sovren\"} 8300
# HELP ce_session_turns_total Total turns in session
# TYPE ce_session_turns_total gauge
ce_session_turns_total{session=\"sess-abc1\",phase=\"plan\",project=\"Sovren\"} 12
# HELP ce_session_agents_total Total agents spawned in session
# TYPE ce_session_agents_total gauge
ce_session_agents_total{session=\"sess-abc1\",phase=\"plan\",project=\"Sovren\"} 0
# HELP ce_session_tasks_total Total tasks completed in session
# TYPE ce_session_tasks_total gauge
ce_session_tasks_total{session=\"sess-abc1\",phase=\"plan\",project=\"Sovren\"} 3
# HELP ce_session_commits_total Total commits in session
# TYPE ce_session_commits_total gauge
ce_session_commits_total{session=\"sess-abc1\",phase=\"plan\",project=\"Sovren\"} 0
"

# ------------------------------------------------------------------
# Session 2: Work phase, Sovren project — team build
# ------------------------------------------------------------------
push_metrics "ce_session" "sess-def456" "
# TYPE ce_session_tokens_total gauge
ce_session_tokens_total{type=\"input\",session=\"sess-def4\",phase=\"work\",project=\"Sovren\"} 312500
ce_session_tokens_total{type=\"output\",session=\"sess-def4\",phase=\"work\",project=\"Sovren\"} 62100
# TYPE ce_session_turns_total gauge
ce_session_turns_total{session=\"sess-def4\",phase=\"work\",project=\"Sovren\"} 48
# TYPE ce_session_agents_total gauge
ce_session_agents_total{session=\"sess-def4\",phase=\"work\",project=\"Sovren\"} 6
# TYPE ce_session_tasks_total gauge
ce_session_tasks_total{session=\"sess-def4\",phase=\"work\",project=\"Sovren\"} 11
# TYPE ce_session_commits_total gauge
ce_session_commits_total{session=\"sess-def4\",phase=\"work\",project=\"Sovren\"} 4
"

# ------------------------------------------------------------------
# Session 3: Review phase
# ------------------------------------------------------------------
push_metrics "ce_session" "sess-ghi789" "
# TYPE ce_session_tokens_total gauge
ce_session_tokens_total{type=\"input\",session=\"sess-ghi7\",phase=\"review\",project=\"Sovren\"} 198400
ce_session_tokens_total{type=\"output\",session=\"sess-ghi7\",phase=\"review\",project=\"Sovren\"} 41200
# TYPE ce_session_turns_total gauge
ce_session_turns_total{session=\"sess-ghi7\",phase=\"review\",project=\"Sovren\"} 35
# TYPE ce_session_agents_total gauge
ce_session_agents_total{session=\"sess-ghi7\",phase=\"review\",project=\"Sovren\"} 13
# TYPE ce_session_tasks_total gauge
ce_session_tasks_total{session=\"sess-ghi7\",phase=\"review\",project=\"Sovren\"} 0
# TYPE ce_session_commits_total gauge
ce_session_commits_total{session=\"sess-ghi7\",phase=\"review\",project=\"Sovren\"} 0
"

# ------------------------------------------------------------------
# Session 4: Compound phase
# ------------------------------------------------------------------
push_metrics "ce_session" "sess-jkl012" "
# TYPE ce_session_tokens_total gauge
ce_session_tokens_total{type=\"input\",session=\"sess-jkl0\",phase=\"compound\",project=\"Sovren\"} 28600
ce_session_tokens_total{type=\"output\",session=\"sess-jkl0\",phase=\"compound\",project=\"Sovren\"} 9100
# TYPE ce_session_turns_total gauge
ce_session_turns_total{session=\"sess-jkl0\",phase=\"compound\",project=\"Sovren\"} 8
# TYPE ce_session_agents_total gauge
ce_session_agents_total{session=\"sess-jkl0\",phase=\"compound\",project=\"Sovren\"} 0
# TYPE ce_session_tasks_total gauge
ce_session_tasks_total{session=\"sess-jkl0\",phase=\"compound\",project=\"Sovren\"} 1
# TYPE ce_session_commits_total gauge
ce_session_commits_total{session=\"sess-jkl0\",phase=\"compound\",project=\"Sovren\"} 1
"

# ------------------------------------------------------------------
# Session 5: Adhoc (no CE workflow)
# ------------------------------------------------------------------
push_metrics "ce_session" "sess-mno345" "
# TYPE ce_session_tokens_total gauge
ce_session_tokens_total{type=\"input\",session=\"sess-mno3\",phase=\"adhoc\",project=\"Sovren\"} 15800
ce_session_tokens_total{type=\"output\",session=\"sess-mno3\",phase=\"adhoc\",project=\"Sovren\"} 3200
# TYPE ce_session_turns_total gauge
ce_session_turns_total{session=\"sess-mno3\",phase=\"adhoc\",project=\"Sovren\"} 6
# TYPE ce_session_agents_total gauge
ce_session_agents_total{session=\"sess-mno3\",phase=\"adhoc\",project=\"Sovren\"} 0
# TYPE ce_session_tasks_total gauge
ce_session_tasks_total{session=\"sess-mno3\",phase=\"adhoc\",project=\"Sovren\"} 0
# TYPE ce_session_commits_total gauge
ce_session_commits_total{session=\"sess-mno3\",phase=\"adhoc\",project=\"Sovren\"} 0
"

echo ""
echo "Done. Check http://localhost:9091 to verify metrics were received."
echo "If Pushgateway was unreachable, start with: docker compose -f docker-compose.dev.yml up pushgateway -d"
