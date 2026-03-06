---
title: 'Lean Agent Metrics + Infrastructure Hardening'
date: 2026-03-06
category: observability
tags: [pushgateway, shell-scripting, metrics, grafana, hooks, bash, performance]
module: scripts/ce-metrics
symptoms:
  - 'Pushgateway rejects duplicate HELP/TYPE declarations'
  - 'Argument list too long when passing JSON to python3'
  - 'GraphQL 500k node limit exceeded'
  - 'UserPromptSubmit hook error on every prompt'
  - 'Script exits with code 1 despite successful push'
  - 'No data in Grafana panels after adding new metrics'
severity: P2
sprint: 'CE Metrics Hardening (03-06)'
pr: 'infra/metrics-hardening branch'
---

# Lean Agent Metrics + Infrastructure Hardening

## Problem

The monolithic `flow-metrics.sh` (248 lines) needed 4 new agent pipeline metrics (gate first-pass rate, change failure rate, agent cycle time, test coverage delta) plus infrastructure hardening (shared API calls, batch Pushgateway POST, modular collectors). During implementation, 6 bugs surfaced — all related to shell scripting edge cases when processing large data through bash+python pipelines.

## What Was Built

### Module Split

```
scripts/ce-metrics/
  flow-metrics.sh          # Entrypoint: 110 lines (was 248)
  lib/
    github-api.sh          # Shared PR list + batched CI runs (1-2 API calls total)
    pushgateway.sh         # Batch accumulator + single POST + stale cleanup
  collectors/
    flow-core.sh           # Velocity, time, load (existing, refactored)
    flow-efficiency.sh     # No-op wrapper (consolidated into agent-pipeline.sh)
    agent-pipeline.sh      # Single-pass JSONL: agent times + phase counts + guardrail blocks
    quality-gates.sh       # Gate first-pass rate + change failure rate
    coverage-delta.sh      # Coverage % + delta from baseline
```

### 4 New Metrics

| Metric                         | Value at Ship | Decision Rule                          |
| ------------------------------ | ------------- | -------------------------------------- |
| `gate_first_pass_rate`         | 55%           | If <70%, investigate CI breakage       |
| `change_failure_rate`          | 35.3%         | If >15%, stop and fix pipeline         |
| `agent_cycle_time_avg_seconds` | (no data yet) | If agent_type X >10min, optimize brief |
| `ce_test_coverage_pct`         | 100%          | If <60%, add tests                     |

### Performance Improvements

| Before                                | After                                         |
| ------------------------------------- | --------------------------------------------- |
| Re-fetched `gh pr list` per collector | 1 shared fetch, passed as `$PR_DATA`          |
| 200 per-PR API calls for gate/failure | 1 batched `gh api actions/runs?per_page=100`  |
| 3 separate JSONL file reads           | Single-pass python3 extracts everything       |
| N individual Pushgateway HTTP POSTs   | 1 batch POST (178 metric lines)               |
| Per-PR time series accumulate forever | `cleanup_stale_pr_metrics` DELETEs old series |

### Dashboard: Row 6 — Agent Quality Gates (6 panels)

Gate First-Pass Rate (gauge), Change Failure Rate (gauge), Test Coverage (stat), Coverage Delta (stat), Agent Cycle Time by Type (barchart), Agent Cycle Time P90 (stat). Rows 2-4 collapsed for scannability.

## 6 Bugs Fixed

### Bug 1: GraphQL 500k Node Limit

**Symptom:** `gh pr list --json ...commits --limit 200` returned "requesting up to 1,000,000 possible nodes which exceeds the maximum limit of 500,000".

**Root cause:** The `commits` field on 200 PRs, each with potentially many commits, multiplied beyond GitHub's GraphQL node limit.

**Fix:** Remove `commits` from the JSON fields. Only `mergeCommit` (single object per PR) was needed.

```bash
# Note: 'commits' field excluded — hits GraphQL 500k node limit at 200 PRs
PR_DATA=$(gh pr list --repo "$REPO" --state merged \
  --json number,title,createdAt,mergedAt,headRefName,additions,deletions,mergeCommit \
  --limit 200 2>/dev/null) || PR_DATA="[]"
```

**Pattern:** When querying GitHub's GraphQL API, avoid collection fields (`commits`, `reviews`, `comments`) on large `--limit` values. Prefer scalar fields or single-object fields (`mergeCommit`).

### Bug 2: Argument List Too Long

**Symptom:** `/opt/homebrew/bin/python3: Argument list too long` when passing `$PR_DATA` (54 PRs of JSON) as a shell argument.

**Root cause:** Shell `ARG_MAX` limit (~262,144 bytes on macOS) exceeded when large JSON is passed via `sys.argv` or heredoc variable expansion.

**Fix:** Write data to temp files, have Python read from files.

```bash
local tmp_pr=$(mktemp)
echo "$pr_data" > "$tmp_pr"

python3 << PYEOF
with open("$tmp_pr") as f:
    prs = json.load(f)
PYEOF

rm -f "$tmp_pr"
```

**Pattern:** For shell→Python data transfer >100KB, always use temp files. `mktemp` + `rm -f` in the same function guarantees cleanup.

### Bug 3: Pushgateway Duplicate HELP/TYPE

**Symptom:** Pushgateway returned HTTP 400 when the buffer contained 53 copies of `# HELP flow_time_hours` (one per PR).

**Root cause:** Pushgateway's text format parser rejects duplicate `# HELP` / `# TYPE` declarations for the same metric name.

**Fix:** Track declared metrics with a pipe-delimited string, only emit HELP/TYPE once per metric name.

```bash
_METRICS_DECLARED=""

buffer_metric() {
  local metric="$1" labels="$2" value="$3" help="${4:-}"
  # Only emit HELP/TYPE once per metric name
  if [ -n "$help" ] && [[ "$_METRICS_DECLARED" != *"|${metric}|"* ]]; then
    METRICS_BUFFER="${METRICS_BUFFER}# HELP ${metric} ${help}
# TYPE ${metric} gauge
"
    _METRICS_DECLARED="${_METRICS_DECLARED}|${metric}|"
  fi
  METRICS_BUFFER="${METRICS_BUFFER}${metric}${label_str} ${value}
"
}
```

**Pattern:** Pipe-delimited string as a set: `|metric_a||metric_b|`. Check membership with `[[ "$str" != *"|${key}|"* ]]`. Simpler than associative arrays, works with `set -u`.

### Bug 4: `set -u` with Associative Arrays

**Symptom:** `_METRICS_DECLARED[$metric]: unbound variable` even with `${_METRICS_DECLARED[$metric]:-}` fallback.

**Root cause:** In bash, `${array[$key]:-}` doesn't suppress the unbound error for associative arrays under `set -u`. The `-` default syntax works for scalar variables but not for array subscripts with keys that don't exist.

**Fix:** Don't use associative arrays. Use pipe-delimited strings instead (see Bug 3).

**Pattern:** Never use `declare -A` (associative arrays) in scripts with `set -u`. Use pipe-delimited strings for set membership, or `grep -q` on a newline-delimited list.

### Bug 5: `[ cond ] && cmd` Exit Code Under `set -e`

**Symptom:** Script exits with code 1 after successful metrics push. `cleanup_stale_pr_metrics` was the last function called.

**Root cause:** `[ "$count" -gt 0 ] && echo "..."` returns exit code 1 when `count=0` (the test fails). Under `set -e`, this terminates the script.

**Fix:** Append `|| true` to prevent the false test from killing the script.

```bash
[ "$count" -gt 0 ] && echo "  Cleaned up $count stale PR metric series" || true
```

**Pattern:** In `set -e` scripts, every `[ cond ] && action` that can legitimately be false MUST have `|| true` appended. Alternative: use `if/then/fi` instead of `&&`.

### Bug 6: UserPromptSubmit Hook Error

**Symptom:** "UserPromptSubmit hook error" on every prompt submission.

**Root cause:** `set -uo pipefail` in `phase-detect-context.sh`. The `-u` (nounset) flag causes errors with array operations (`${context_parts[@]:1}` on single-element arrays) and the `trap 'exit 0' ERR` doesn't catch all `-u` errors in all bash versions.

**Fix:** Remove `set -u`, add defensive input guards.

```bash
# Before (broken):
set -uo pipefail
trap 'exit 0' ERR
input=$(cat)

# After (fixed):
set -o pipefail
trap 'exit 0' ERR
input=$(cat 2>/dev/null) || exit 0
[ -n "$input" ] || exit 0
```

**Pattern:** Never use `set -u` in Claude Code hooks. The trap doesn't reliably catch nounset errors across bash versions. Instead, use explicit `[ -n "$var" ] || exit 0` guards and `${var:-default}` fallbacks.

## Key Design Decisions

| Decision                           | Rationale                                                                    |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| Sourced files, not subprocesses    | Shared variables (`$PR_DATA`, `$METRICS_BUFFER`) work across file boundaries |
| METRIC: protocol for Python output | Python can't call shell functions; pipe-delimited protocol is clean IPC      |
| Single Pushgateway POST            | One clear error if Pushgateway is down, not N silent partial failures        |
| `mktemp` for large JSON            | Avoids `ARG_MAX` shell limit — documented at each call site                  |
| No panel for guardrail blocks      | YAGNI: data collected now, visualized when it accumulates                    |
| `flow-efficiency.sh` as no-op      | Preserves module boundary without forcing a second JSONL read                |
| Rows 2-4 collapsed                 | Keeps dashboard scannable — KPI row + Quality Gates visible by default       |

## Prevention Strategies

1. **Test shell scripts with `bash -x`** before committing — traces show exactly which line fails
2. **Never use `set -u` in hooks** — use explicit guards instead (see Bug 6)
3. **Always `|| true` on conditional `&&` chains** in `set -e` scripts
4. **Use temp files for >100KB data transfer** between shell and Python
5. **Check Pushgateway text format rules** — no duplicate HELP/TYPE per metric name
6. **Test with `--once` flag** to isolate single-run behavior from watch loops

## Cross-References

- Prior sprint: [Flow Framework Metrics Dashboard Pivot](../observability/flow-framework-metrics-dashboard-pivot-20260306.md) — patterns #91-#97
- Prior sprint: [Enforcement Hooks Implementation](~/.claude/docs/solutions/infrastructure/enforcement-hooks-implementation.md) — patterns #98-#102
- Prior sprint: [Prevention: Metrics Dashboard Design](../process-issues/prevention-metrics-dashboard-design-20260305.md) — 7 anti-patterns
- Docs: [CE_METRICS_DASHBOARD.md](../../development/CE_METRICS_DASHBOARD.md) — canonical metrics reference
- New patterns: common-solutions.md #103-#106
