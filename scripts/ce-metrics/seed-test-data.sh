#!/usr/bin/env bash
# CE Metrics — Seed Test Data (5 Dimensions)
# Pushes synthetic CE metrics to Pushgateway for dashboard verification
# Covers: Cost, Velocity, Quality, Knowledge Compounding, Agent Efficiency

set -euo pipefail

PUSHGATEWAY_URL="${PUSHGATEWAY_URL:-http://localhost:9091}"

echo "Seeding CE metrics (5 dimensions) to Pushgateway at $PUSHGATEWAY_URL..."

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

# ──────────────────────────────────────────────────────────────────────────
# PR #132 — Content Shield MVP (plan phase, solo)
# ──────────────────────────────────────────────────────────────────────────
push_metrics "ce_session" "sess-pr132a" "
# HELP ce_session_cost_usd Estimated session cost in USD
# TYPE ce_session_cost_usd gauge
ce_session_cost_usd{session=\"pr132-pl\",phase=\"plan\",project=\"Sovren\",pr_number=\"132\"} 0.8940

# HELP ce_session_tokens_total Total tokens used in session by type
# TYPE ce_session_tokens_total gauge
ce_session_tokens_total{type=\"input\",session=\"pr132-pl\",phase=\"plan\",project=\"Sovren\",pr_number=\"132\"} 45200
ce_session_tokens_total{type=\"output\",session=\"pr132-pl\",phase=\"plan\",project=\"Sovren\",pr_number=\"132\"} 8300
ce_session_tokens_total{type=\"cache_read\",session=\"pr132-pl\",phase=\"plan\",project=\"Sovren\",pr_number=\"132\"} 12400
ce_session_tokens_total{type=\"cache_creation\",session=\"pr132-pl\",phase=\"plan\",project=\"Sovren\",pr_number=\"132\"} 3100

# HELP ce_session_tokens_by_model Token usage per model
# TYPE ce_session_tokens_by_model gauge
ce_session_tokens_by_model{model=\"opus\",type=\"input\",session=\"pr132-pl\",phase=\"plan\",project=\"Sovren\",pr_number=\"132\"} 45200
ce_session_tokens_by_model{model=\"opus\",type=\"output\",session=\"pr132-pl\",phase=\"plan\",project=\"Sovren\",pr_number=\"132\"} 8300

# HELP ce_session_turns_total Total turns in session
# TYPE ce_session_turns_total gauge
ce_session_turns_total{session=\"pr132-pl\",phase=\"plan\",project=\"Sovren\",pr_number=\"132\"} 12

# HELP ce_findings_total Review findings by severity
# TYPE ce_findings_total gauge
ce_findings_total{severity=\"p1\",session=\"pr132-pl\",phase=\"plan\",project=\"Sovren\",pr_number=\"132\"} 0
ce_findings_total{severity=\"p2\",session=\"pr132-pl\",phase=\"plan\",project=\"Sovren\",pr_number=\"132\"} 0
ce_findings_total{severity=\"p3\",session=\"pr132-pl\",phase=\"plan\",project=\"Sovren\",pr_number=\"132\"} 0

# HELP ce_lines_changed Lines changed vs origin/main
# TYPE ce_lines_changed gauge
ce_lines_changed{type=\"added\",session=\"pr132-pl\",phase=\"plan\",project=\"Sovren\",pr_number=\"132\"} 0
ce_lines_changed{type=\"deleted\",session=\"pr132-pl\",phase=\"plan\",project=\"Sovren\",pr_number=\"132\"} 0

# HELP ce_session_agents_total Total agents spawned
# TYPE ce_session_agents_total gauge
ce_session_agents_total{session=\"pr132-pl\",phase=\"plan\",project=\"Sovren\",pr_number=\"132\"} 2

# HELP ce_session_tasks_total Total tasks completed
# TYPE ce_session_tasks_total gauge
ce_session_tasks_total{session=\"pr132-pl\",phase=\"plan\",project=\"Sovren\",pr_number=\"132\"} 3

# HELP ce_session_commits_total Total commits
# TYPE ce_session_commits_total gauge
ce_session_commits_total{session=\"pr132-pl\",phase=\"plan\",project=\"Sovren\",pr_number=\"132\"} 0

# HELP ce_agent_duration_seconds_avg Average agent duration
# TYPE ce_agent_duration_seconds_avg gauge
ce_agent_duration_seconds_avg{session=\"pr132-pl\",phase=\"plan\",project=\"Sovren\",pr_number=\"132\"} 45
"

# ──────────────────────────────────────────────────────────────────────────
# PR #136 — Business Manager MVP (work phase, team build)
# ──────────────────────────────────────────────────────────────────────────
push_metrics "ce_session" "sess-pr136w" "
# TYPE ce_session_cost_usd gauge
ce_session_cost_usd{session=\"pr136-wk\",phase=\"work\",project=\"Sovren\",pr_number=\"136\"} 5.7250

# TYPE ce_session_tokens_total gauge
ce_session_tokens_total{type=\"input\",session=\"pr136-wk\",phase=\"work\",project=\"Sovren\",pr_number=\"136\"} 312500
ce_session_tokens_total{type=\"output\",session=\"pr136-wk\",phase=\"work\",project=\"Sovren\",pr_number=\"136\"} 62100
ce_session_tokens_total{type=\"cache_read\",session=\"pr136-wk\",phase=\"work\",project=\"Sovren\",pr_number=\"136\"} 89200
ce_session_tokens_total{type=\"cache_creation\",session=\"pr136-wk\",phase=\"work\",project=\"Sovren\",pr_number=\"136\"} 15600

# TYPE ce_session_tokens_by_model gauge
ce_session_tokens_by_model{model=\"opus\",type=\"input\",session=\"pr136-wk\",phase=\"work\",project=\"Sovren\",pr_number=\"136\"} 210000
ce_session_tokens_by_model{model=\"opus\",type=\"output\",session=\"pr136-wk\",phase=\"work\",project=\"Sovren\",pr_number=\"136\"} 42000
ce_session_tokens_by_model{model=\"sonnet\",type=\"input\",session=\"pr136-wk\",phase=\"work\",project=\"Sovren\",pr_number=\"136\"} 82500
ce_session_tokens_by_model{model=\"sonnet\",type=\"output\",session=\"pr136-wk\",phase=\"work\",project=\"Sovren\",pr_number=\"136\"} 16100
ce_session_tokens_by_model{model=\"haiku\",type=\"input\",session=\"pr136-wk\",phase=\"work\",project=\"Sovren\",pr_number=\"136\"} 20000
ce_session_tokens_by_model{model=\"haiku\",type=\"output\",session=\"pr136-wk\",phase=\"work\",project=\"Sovren\",pr_number=\"136\"} 4000

# TYPE ce_session_turns_total gauge
ce_session_turns_total{session=\"pr136-wk\",phase=\"work\",project=\"Sovren\",pr_number=\"136\"} 48

# TYPE ce_findings_total gauge
ce_findings_total{severity=\"p1\",session=\"pr136-wk\",phase=\"work\",project=\"Sovren\",pr_number=\"136\"} 0
ce_findings_total{severity=\"p2\",session=\"pr136-wk\",phase=\"work\",project=\"Sovren\",pr_number=\"136\"} 0
ce_findings_total{severity=\"p3\",session=\"pr136-wk\",phase=\"work\",project=\"Sovren\",pr_number=\"136\"} 0

# TYPE ce_lines_changed gauge
ce_lines_changed{type=\"added\",session=\"pr136-wk\",phase=\"work\",project=\"Sovren\",pr_number=\"136\"} 6465
ce_lines_changed{type=\"deleted\",session=\"pr136-wk\",phase=\"work\",project=\"Sovren\",pr_number=\"136\"} 1020

# TYPE ce_session_agents_total gauge
ce_session_agents_total{session=\"pr136-wk\",phase=\"work\",project=\"Sovren\",pr_number=\"136\"} 6

# TYPE ce_session_tasks_total gauge
ce_session_tasks_total{session=\"pr136-wk\",phase=\"work\",project=\"Sovren\",pr_number=\"136\"} 11

# TYPE ce_session_commits_total gauge
ce_session_commits_total{session=\"pr136-wk\",phase=\"work\",project=\"Sovren\",pr_number=\"136\"} 4

# TYPE ce_agent_duration_seconds_avg gauge
ce_agent_duration_seconds_avg{session=\"pr136-wk\",phase=\"work\",project=\"Sovren\",pr_number=\"136\"} 180
"

# ──────────────────────────────────────────────────────────────────────────
# PR #137 — Comments CRUD (review phase, 8 agents)
# ──────────────────────────────────────────────────────────────────────────
push_metrics "ce_session" "sess-pr137r" "
# TYPE ce_session_cost_usd gauge
ce_session_cost_usd{session=\"pr137-rv\",phase=\"review\",project=\"Sovren\",pr_number=\"137\"} 3.2100

# TYPE ce_session_tokens_total gauge
ce_session_tokens_total{type=\"input\",session=\"pr137-rv\",phase=\"review\",project=\"Sovren\",pr_number=\"137\"} 198400
ce_session_tokens_total{type=\"output\",session=\"pr137-rv\",phase=\"review\",project=\"Sovren\",pr_number=\"137\"} 41200
ce_session_tokens_total{type=\"cache_read\",session=\"pr137-rv\",phase=\"review\",project=\"Sovren\",pr_number=\"137\"} 65300
ce_session_tokens_total{type=\"cache_creation\",session=\"pr137-rv\",phase=\"review\",project=\"Sovren\",pr_number=\"137\"} 8700

# TYPE ce_session_tokens_by_model gauge
ce_session_tokens_by_model{model=\"opus\",type=\"input\",session=\"pr137-rv\",phase=\"review\",project=\"Sovren\",pr_number=\"137\"} 148000
ce_session_tokens_by_model{model=\"opus\",type=\"output\",session=\"pr137-rv\",phase=\"review\",project=\"Sovren\",pr_number=\"137\"} 31000
ce_session_tokens_by_model{model=\"sonnet\",type=\"input\",session=\"pr137-rv\",phase=\"review\",project=\"Sovren\",pr_number=\"137\"} 50400
ce_session_tokens_by_model{model=\"sonnet\",type=\"output\",session=\"pr137-rv\",phase=\"review\",project=\"Sovren\",pr_number=\"137\"} 10200

# TYPE ce_session_turns_total gauge
ce_session_turns_total{session=\"pr137-rv\",phase=\"review\",project=\"Sovren\",pr_number=\"137\"} 35

# TYPE ce_findings_total gauge
ce_findings_total{severity=\"p1\",session=\"pr137-rv\",phase=\"review\",project=\"Sovren\",pr_number=\"137\"} 4
ce_findings_total{severity=\"p2\",session=\"pr137-rv\",phase=\"review\",project=\"Sovren\",pr_number=\"137\"} 7
ce_findings_total{severity=\"p3\",session=\"pr137-rv\",phase=\"review\",project=\"Sovren\",pr_number=\"137\"} 6

# TYPE ce_lines_changed gauge
ce_lines_changed{type=\"added\",session=\"pr137-rv\",phase=\"review\",project=\"Sovren\",pr_number=\"137\"} 6465
ce_lines_changed{type=\"deleted\",session=\"pr137-rv\",phase=\"review\",project=\"Sovren\",pr_number=\"137\"} 1020

# TYPE ce_session_agents_total gauge
ce_session_agents_total{session=\"pr137-rv\",phase=\"review\",project=\"Sovren\",pr_number=\"137\"} 13

# TYPE ce_session_tasks_total gauge
ce_session_tasks_total{session=\"pr137-rv\",phase=\"review\",project=\"Sovren\",pr_number=\"137\"} 0

# TYPE ce_session_commits_total gauge
ce_session_commits_total{session=\"pr137-rv\",phase=\"review\",project=\"Sovren\",pr_number=\"137\"} 0

# TYPE ce_agent_duration_seconds_avg gauge
ce_agent_duration_seconds_avg{session=\"pr137-rv\",phase=\"review\",project=\"Sovren\",pr_number=\"137\"} 95
"

# ──────────────────────────────────────────────────────────────────────────
# Knowledge Compounding metrics (project-level, no session)
# ──────────────────────────────────────────────────────────────────────────
push_metrics "ce_knowledge" "sovren" "
# HELP ce_compound_docs_total Count of compound docs
# TYPE ce_compound_docs_total gauge
ce_compound_docs_total{project=\"Sovren\"} 42

# HELP ce_pattern_count Lines in common-solutions.md
# TYPE ce_pattern_count gauge
ce_pattern_count{project=\"Sovren\"} 1847
"

echo ""
echo "Done. Seeded 3 PRs across plan/work/review phases + knowledge metrics."
echo "Check http://localhost:9091 to verify metrics were received."
echo "Open Grafana at http://localhost:3002 → CE Metrics Dashboard to see all 5 dimensions."
echo "If Pushgateway was unreachable, start with: docker compose -f docker-compose.dev.yml up pushgateway -d"
