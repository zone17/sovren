#!/usr/bin/env bash
# CE Metrics — Test Coverage Delta Collector
# Collects: ce_test_coverage_pct, test_coverage_delta_pct
# Requires: lib/pushgateway.sh sourced first

COVERAGE_BASELINE="$HOME/.claude/metrics/coverage-baseline.json"

collect_coverage_delta() {
  # Look for coverage data from latest test run
  local coverage_file=""
  local search_dirs=(
    "coverage/coverage-final.json"
    "packages/frontend/coverage/coverage-final.json"
    "packages/backend/coverage/coverage-final.json"
  )

  for f in "${search_dirs[@]}"; do
    if [ -f "$f" ]; then
      coverage_file="$f"
      break
    fi
  done

  if [ -z "$coverage_file" ]; then
    echo "  Coverage Delta: no coverage-final.json found"
    return
  fi

  # Parse total line coverage %
  local current_pct
  current_pct=$(python3 << PYEOF - "$coverage_file"
import json, sys

with open(sys.argv[1]) as f:
    data = json.load(f)

total_statements = 0
covered_statements = 0
for file_path, file_data in data.items():
    s = file_data.get("s", {})
    total_statements += len(s)
    covered_statements += sum(1 for v in s.values() if v > 0)

if total_statements > 0:
    print(f"{covered_statements / total_statements * 100:.1f}")
else:
    print("0")
PYEOF
)

  [ -n "$current_pct" ] || { echo "  Coverage Delta: could not parse coverage"; return; }

  buffer_metric "ce_test_coverage_pct" "project=\"$PROJECT\"" "$current_pct" "Current test coverage percentage"
  echo "  Test Coverage: ${current_pct}%"

  # Compute delta from baseline
  if [ -f "$COVERAGE_BASELINE" ]; then
    local baseline_pct
    baseline_pct=$(python3 -c "import json; print(json.load(open('$COVERAGE_BASELINE')).get('coverage_pct', 0))" 2>/dev/null || echo "0")

    local delta
    delta=$(python3 -c "print(f'{${current_pct} - ${baseline_pct}:.1f}')" 2>/dev/null || echo "0")

    buffer_metric "test_coverage_delta_pct" "project=\"$PROJECT\"" "$delta" "Coverage change from baseline"
    echo "  Coverage Delta: ${delta}% (baseline: ${baseline_pct}%)"
  else
    echo "  Coverage Delta: no baseline yet (will be set after next merge to main)"
  fi
}
