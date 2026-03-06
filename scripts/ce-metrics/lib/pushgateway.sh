#!/usr/bin/env bash
# CE Metrics — Pushgateway Helper Library
# Provides batch metric accumulation and single-POST push

PUSHGATEWAY_URL="${PUSHGATEWAY_URL:-http://localhost:9091}"
PROJECT="${PROJECT:-Sovren}"

# ── Batch accumulator ──────────────────────────────────────────────
METRICS_BUFFER=""

# Track which metrics already have HELP/TYPE declarations (pipe-delimited string)
_METRICS_DECLARED=""

# Buffer a metric line for batch push (no HTTP call)
# Usage: buffer_metric "metric_name" 'label="val"' "value" ["help text"]
buffer_metric() {
  local metric="$1" labels="$2" value="$3" help="${4:-}"
  local label_str=""
  [ -n "$labels" ] && label_str="{$labels}"

  # Only emit HELP/TYPE once per metric name (Pushgateway rejects duplicates)
  if [ -n "$help" ] && [[ "$_METRICS_DECLARED" != *"|${metric}|"* ]]; then
    METRICS_BUFFER="${METRICS_BUFFER}# HELP ${metric} ${help}
# TYPE ${metric} gauge
"
    _METRICS_DECLARED="${_METRICS_DECLARED}|${metric}|"
  fi
  METRICS_BUFFER="${METRICS_BUFFER}${metric}${label_str} ${value}
"
}

# Push entire buffer to Pushgateway in a single POST
flush_metrics_buffer() {
  [ -n "$METRICS_BUFFER" ] || return 0

  local url="${PUSHGATEWAY_URL}/metrics/job/ce_flow/project/${PROJECT}"
  if echo "$METRICS_BUFFER" | curl --connect-timeout 3 --max-time 10 --fail --silent \
    --data-binary @- "$url" 2>/dev/null; then
    echo "  Pushed $(echo "$METRICS_BUFFER" | grep -cv '^#\|^$') metric lines in single POST"
  else
    echo "  WARNING: Pushgateway push failed (is it running at $PUSHGATEWAY_URL?)"
  fi

  METRICS_BUFFER=""
}

# Delete stale per-PR time series not in the current PR set
# Usage: cleanup_stale_pr_metrics "$PR_DATA"
cleanup_stale_pr_metrics() {
  local pr_data="$1"
  [ -n "$pr_data" ] || return 0

  # Get current PR numbers from data
  local current_prs
  current_prs=$(echo "$pr_data" | python3 -c "
import json, sys
prs = json.loads(sys.stdin.read())
for pr in prs:
    print(pr['number'])
" 2>/dev/null) || return 0

  # Get all PR-labeled series from Pushgateway
  local pg_metrics
  pg_metrics=$(curl -s --connect-timeout 2 --max-time 5 \
    "${PUSHGATEWAY_URL}/api/v1/metrics" 2>/dev/null) || return 0

  # Extract PR numbers from Pushgateway metric labels
  local stale_prs
  stale_prs=$(echo "$pg_metrics" | python3 -c "
import json, sys
current = set(line.strip() for line in '''${current_prs}'''.strip().split('\n') if line.strip())
try:
    data = json.loads(sys.stdin.read())
    seen = set()
    for family in data.get('data', []):
        for sample in family.get('samples', []):
            pr = sample.get('labels', {}).get('pr', '')
            if pr and pr not in current and pr not in seen:
                seen.add(pr)
                print(pr)
except Exception:
    pass
" 2>/dev/null) || return 0

  local count=0
  while IFS= read -r pr_num; do
    [ -n "$pr_num" ] || continue
    # Delete this PR's metrics from Pushgateway
    curl -s --connect-timeout 2 --max-time 3 -X DELETE \
      "${PUSHGATEWAY_URL}/metrics/job/ce_flow/project/${PROJECT}/pr/${pr_num}" 2>/dev/null || true
    count=$((count + 1))
  done <<< "$stale_prs"

  [ "$count" -gt 0 ] && echo "  Cleaned up $count stale PR metric series" || true
}
