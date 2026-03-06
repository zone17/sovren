#!/usr/bin/env bash
# CE Metrics — Quality Gates Collector
# Collects: gate_first_pass_rate, change_failure_rate
# Requires: lib/github-api.sh, lib/pushgateway.sh sourced first

collect_gate_and_failure_rates() {
  local pr_data="${1:-$PR_DATA}"
  local runs_data="${2:-$RUNS_DATA}"

  [ -n "$pr_data" ] && [ "$pr_data" != "[]" ] || { echo "  Quality Gates: no PR data"; return; }
  [ -n "$runs_data" ] || { echo "  Quality Gates: no runs data"; return; }

  # Write data to temp files (avoids "Argument list too long" for large JSON)
  local tmp_pr tmp_runs
  tmp_pr=$(mktemp)
  tmp_runs=$(mktemp)
  echo "$pr_data" > "$tmp_pr"
  echo "$runs_data" > "$tmp_runs"

  local output
  output=$(python3 << PYEOF
import json

project = "$PROJECT"

with open("$tmp_pr") as f:
    prs = json.load(f)
with open("$tmp_runs") as f:
    runs = json.load(f)

metrics = []

# Build SHA -> run lookup from batched runs data
sha_to_runs = {}
for run in runs.get("workflow_runs", []):
    sha = run.get("head_sha", "")
    if sha:
        if sha not in sha_to_runs:
            sha_to_runs[sha] = []
        sha_to_runs[sha].append(run)

# -- Gate First-Pass Rate --
# A PR "passes first" if the CI run on its merge commit succeeded on attempt 1
first_pass = 0
total_evaluated = 0

for pr in prs:
    mc = pr.get("mergeCommit") or {}
    sha = mc.get("oid", "")
    if not sha:
        continue

    pr_runs = sha_to_runs.get(sha, [])
    if not pr_runs:
        continue

    total_evaluated += 1

    passed = any(
        r.get("run_attempt", 1) == 1 and r.get("conclusion") == "success"
        for r in pr_runs
    )
    if passed:
        first_pass += 1

gate_rate = first_pass / total_evaluated if total_evaluated else 0
metrics.append(f'METRIC:gate_first_pass_rate|project="{project}"|{gate_rate:.3f}|CI first-pass success rate across PRs')

if total_evaluated > 0:
    print(f"  Gate First-Pass Rate: {gate_rate:.1%} ({first_pass}/{total_evaluated} PRs)")
else:
    print("  Gate First-Pass Rate: no evaluated PRs")

# -- Change Failure Rate --
main_runs = [r for r in runs.get("workflow_runs", []) if r.get("head_branch") == "main"]

merge_shas = set()
for pr in prs:
    mc = pr.get("mergeCommit") or {}
    sha = mc.get("oid", "")
    if sha:
        merge_shas.add(sha)

main_failures = 0
main_total = 0
for run in main_runs:
    sha = run.get("head_sha", "")
    if sha in merge_shas:
        main_total += 1
        if run.get("conclusion") != "success":
            main_failures += 1

failure_rate = main_failures / main_total if main_total else 0
metrics.append(f'METRIC:change_failure_rate|project="{project}"|{failure_rate:.3f}|Rate of CI failures on main after merge')

if main_total > 0:
    print(f"  Change Failure Rate: {failure_rate:.1%} ({main_failures}/{main_total} main runs)")
else:
    print("  Change Failure Rate: no main-branch runs matched")

for m in metrics:
    print(m)
PYEOF
)

  rm -f "$tmp_pr" "$tmp_runs"

  # Parse METRIC: lines
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
