#!/usr/bin/env bash
# CE Flow Metrics — Entrypoint
#
# Collects all flow + agent pipeline metrics and pushes to Pushgateway.
# Sources modular collectors from collectors/ and libraries from lib/.
#
# Metrics collected:
#   flow_velocity           — PRs merged per week (rolling 4 weeks)
#   flow_time_hours         — End-to-end time from PR create to merge
#   flow_load               — Current open PRs (WIP)
#   flow_efficiency_ratio   — Active work ratio (work phase / total)
#   gate_first_pass_rate    — CI first-pass success rate
#   change_failure_rate     — CI failures on main after merge
#   agent_cycle_time_*      — Agent completion times by type
#   ce_test_coverage_pct    — Current test coverage
#   test_coverage_delta_pct — Coverage change from baseline
#
# Usage: bash flow-metrics.sh [--once | --watch]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Export config for sourced scripts
export PUSHGATEWAY_URL="${PUSHGATEWAY_URL:-http://localhost:9091}"
export GITHUB_REPO="${GITHUB_REPO:-zone17/sovren}"
export REPO="${GITHUB_REPO}"
export PROJECT="${PROJECT:-Sovren}"

# Source libraries
source "$SCRIPT_DIR/lib/github-api.sh"
source "$SCRIPT_DIR/lib/pushgateway.sh"

# Source collectors
source "$SCRIPT_DIR/collectors/flow-core.sh"
source "$SCRIPT_DIR/collectors/flow-efficiency.sh"
source "$SCRIPT_DIR/collectors/agent-pipeline.sh"
source "$SCRIPT_DIR/collectors/quality-gates.sh"
source "$SCRIPT_DIR/collectors/coverage-delta.sh"

# ── Helper: parse METRIC: protocol lines from python output ────────
# Python collectors print "METRIC:name|labels|value|help" lines
# This function captures them and calls buffer_metric()
parse_collector_output() {
  local output="$1"
  while IFS= read -r line; do
    if [[ "$line" == METRIC:* ]]; then
      local rest="${line#METRIC:}"
      local metric="${rest%%|*}"; rest="${rest#*|}"
      local labels="${rest%%|*}"; rest="${rest#*|}"
      local value="${rest%%|*}"; rest="${rest#*|}"
      local help="$rest"
      buffer_metric "$metric" "$labels" "$value" "$help"
    else
      echo "$line"
    fi
  done <<< "$output"
}

# ── Main ───────────────────────────────────────────────────────────

run_once() {
  echo "CE Flow Metrics — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "================================================"
  echo ""

  # Fetch PR + CI data once, share across collectors
  fetch_merged_prs
  fetch_actions_runs

  # Flow metrics (velocity, time, load)
  collect_flow_load
  local vt_output
  vt_output=$(collect_flow_velocity_and_time "$PR_DATA")
  parse_collector_output "$vt_output"

  # Phase + agent metrics (single-pass JSONL)
  collect_agent_and_phase_metrics

  # Quality gate metrics (GitHub API)
  collect_gate_and_failure_rates "$PR_DATA" "$RUNS_DATA"

  # Coverage delta
  collect_coverage_delta

  # Single batch push
  echo ""
  flush_metrics_buffer

  # Cleanup stale per-PR series
  cleanup_stale_pr_metrics "$PR_DATA"

  echo ""
  echo "Done. Metrics pushed to $PUSHGATEWAY_URL"
}

case "${1:-}" in
  --watch)
    echo "Watching flow metrics every 5 minutes (Ctrl+C to stop)"
    while true; do
      run_once
      echo ""
      echo "Next update in 5 minutes..."
      sleep 300
    done
    ;;
  *)
    run_once
    ;;
esac
