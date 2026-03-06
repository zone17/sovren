# CE Metrics Dashboard

Track engineering metrics across **Flow Framework** (4 DORA-aligned metrics) + **Agent Pipeline** (4 agent-specific metrics).

## Architecture

```
Claude Code Hooks → JSONL → session-end.sh → Pushgateway → Prometheus → Grafana
                              ↑
Workflow Hooks → set-phase.sh ┘ (preserves session_id/branch in ce-phase.json)

flow-metrics.sh (cron/manual):
  lib/github-api.sh   ← gh pr list + gh api actions/runs (batched, 1-2 calls)
  lib/pushgateway.sh  ← batch accumulator + single POST + stale cleanup
  collectors/
    flow-core.sh      ← velocity, time, load
    flow-efficiency.sh ← (consolidated into agent-pipeline.sh)
    agent-pipeline.sh  ← agent cycle times + phase counts (single-pass JSONL)
    quality-gates.sh   ← gate first-pass rate, change failure rate
    coverage-delta.sh  ← test coverage % + delta from baseline

Enforcement Hooks → guardrail_block events → JSONL (data collection only)
```

## Setup

### Prerequisites

- Docker Desktop running
- jq installed (`brew install jq`)
- Claude Code with hooks support

### Install

```bash
# Start monitoring stack
docker compose -f docker-compose.dev.yml up -d prometheus pushgateway grafana

# Install hooks
bash scripts/ce-metrics/install-hooks.sh

# Verify installation
bash scripts/ce-metrics/check-health.sh
```

### Run Flow Metrics

```bash
# One-time collection
bash scripts/ce-metrics/flow-metrics.sh

# Continuous (every 5 minutes)
bash scripts/ce-metrics/flow-metrics.sh --watch
```

## Metrics

### Flow Framework (Rows 1-4)

| Metric                       | Decision Rule                                     | Source                         |
| ---------------------------- | ------------------------------------------------- | ------------------------------ |
| `flow_velocity_prs_per_week` | If <5/week, investigate blockers                  | `gh pr list --state merged`    |
| `flow_time_median_hours`     | If >24h, reduce WIP                               | `gh pr list --state merged`    |
| `flow_load`                  | If >5, reduce WIP                                 | `gh pr list --state open`      |
| `flow_efficiency_ratio`      | If <15%, simplify process; >30%, skipping reviews | `ce-events.jsonl` phase counts |

### Agent Quality Gates (Row 5 — NEW)

| Metric                         | Decision Rule                              | Source                                                                |
| ------------------------------ | ------------------------------------------ | --------------------------------------------------------------------- |
| `gate_first_pass_rate`         | If <70%, investigate CI breakage           | `gh api actions/runs` — check `run_attempt==1 && conclusion==success` |
| `change_failure_rate`          | If >15%, stop and fix pipeline             | CI runs on main after squash-merge                                    |
| `agent_cycle_time_avg_seconds` | If agent_type X >10min avg, optimize brief | `ce-events.jsonl` `agent_complete` events                             |
| `ce_test_coverage_pct`         | If <60%, add tests                         | `coverage/coverage-final.json`                                        |
| `test_coverage_delta_pct`      | If <0 on 2+ consecutive PRs, investigate   | Current vs `coverage-baseline.json`                                   |

### Guardrail Blocks (data collection only — no panel)

| Metric                        | Source                                     |
| ----------------------------- | ------------------------------------------ |
| `guardrail_block_count{rule}` | `ce-events.jsonl` `guardrail_block` events |

Guardrail data is emitted by enforcement hooks (`security-gate-bash.sh`, `security-gate-files.sh`, `branch-discipline.sh`) but has no dashboard panel. Data accumulates in JSONL for future analysis.

## Module Structure

```
scripts/ce-metrics/
  flow-metrics.sh                 # Entrypoint: source all, run_once(), --watch
  collectors/
    flow-core.sh                  # Velocity, time, load
    flow-efficiency.sh            # Wrapper (consolidated into agent-pipeline.sh)
    agent-pipeline.sh             # Single-pass JSONL: agent times + phase counts
    quality-gates.sh              # Gate first-pass rate, change failure rate
    coverage-delta.sh             # Coverage % + delta from baseline
  lib/
    github-api.sh                 # Shared PR list, batched actions/runs, rate limit
    pushgateway.sh                # Batch accumulator, single POST, stale cleanup
```

### Performance

- **Shared PR list**: Fetched once (`gh pr list --limit 200`), passed to all collectors
- **Batched CI runs**: Single `gh api actions/runs?per_page=100` instead of per-PR calls
- **Single-pass JSONL**: One python3 pass extracts agent durations + phase counts + guardrail blocks
- **Batch Pushgateway**: All metrics accumulated in `$METRICS_BUFFER`, pushed in single POST
- **Stale cleanup**: Per-PR time series deleted if PR no longer in 200 most recent

## Dashboard Panels (25 panels, 6 rows)

### Row 1: Flow KPIs (4 panels)

- **Flow Velocity** — PRs/week (stat, green >=10)
- **Flow Time (Median)** — hours to merge (stat, green <8h)
- **Flow Load (WIP)** — open PRs (stat, green <3)
- **Flow Efficiency** — work ratio (gauge, green >30%)

### Row 2: Flow Velocity — Value Delivered (3 panels, collapsed)

- **PRs Merged per Week** — bar chart
- **PRs Merged (4 Weeks Total)** — stat
- **Lines Changed per PR** — bar chart (green +, red -)

### Row 3: Flow Time — Speed of Delivery (2 panels, collapsed)

- **Flow Time per PR** — bar chart (continuous color scale)
- **Flow Time Distribution** — median, avg, P90

### Row 4: Flow Efficiency — Active Work Ratio (2 panels, collapsed)

- **Phase Distribution** — donut chart
- **Flow Efficiency Note** — explainer text

### Row 5: Flow Load — Work in Progress (2 panels)

- **Current Open PRs** — gauge (green <3, red >5)
- **WIP Guidance** — Little's Law explainer

### Row 6: Agent Quality Gates (6 panels — NEW)

- **Gate First-Pass Rate** — gauge (green >=90%, yellow >=70%, red <70%)
- **Change Failure Rate** — gauge (green <10%, yellow <20%, red >=20%)
- **Test Coverage** — stat (green >=80%, yellow >=60%, red <60%)
- **Coverage Delta** — stat (+/- %, green >0, red <0)
- **Agent Cycle Time by Type** — bar chart (seconds, by agent_type)
- **Agent Cycle Time P90** — stat (yellow >300s, red >600s)

## Test Coverage Delta — How It Works

1. **Capture**: `session-end.sh` checks if tests ran (via `detect-test-run.sh` flag). If yes and `coverage-final.json` exists, pushes `ce_test_coverage_pct` to Pushgateway.
2. **Baseline**: `post-git-actions.sh` snapshots coverage after `gh pr merge` to `~/.claude/metrics/coverage-baseline.json`.
3. **Delta**: `collectors/coverage-delta.sh` compares current vs baseline and pushes `test_coverage_delta_pct`.
4. **Bootstrap**: First run shows "No baseline yet". After first merge with test coverage, baseline is established.

## Guardrail JSONL Emit

Enforcement hooks emit `guardrail_block` events using subshell isolation:

```bash
# Before each exit 2 in enforcement hooks:
(umask 077; printf '{"type":"guardrail_block","timestamp":"%s","hook":"%s","rule":"%s"}\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "hook-name" "rule-name" \
  >> "$CE_EVENTS_FILE") 2>/dev/null || true
exit 2
```

Subshell isolation ensures `set -e` cannot bypass `exit 2`. Rules tracked:

| Hook                  | Rules                                                                               |
| --------------------- | ----------------------------------------------------------------------------------- |
| `security-gate-bash`  | rm_rf, force_push_main, direct_push_main, git_reset_hard, drop_table, watch_ci_gate |
| `security-gate-files` | env_file, credential_file, path_traversal                                           |
| `branch-discipline`   | commit_on_main, push_on_main                                                        |

## Configuration

| Setting           | Location                                   | Default                 |
| ----------------- | ------------------------------------------ | ----------------------- |
| Pushgateway URL   | `PUSHGATEWAY_URL` env var                  | `http://localhost:9091` |
| GitHub repo       | `GITHUB_REPO` env var                      | `zone17/sovren`         |
| Grafana port      | `docker-compose.dev.yml`                   | 3002                    |
| Dashboard refresh | `ce-metrics-main.json`                     | 5 minutes               |
| JSONL rotation    | lib.sh `rotate_jsonl()`                    | 10MB                    |
| Coverage baseline | `~/.claude/metrics/coverage-baseline.json` | auto after first merge  |
| JSONL permissions | lib.sh `ce_ensure_dirs()`                  | 600 (umask 077)         |

## Troubleshooting

**No data in Grafana**

1. Run `bash scripts/ce-metrics/flow-metrics.sh` to push flow data
2. Run `bash scripts/ce-metrics/check-health.sh`
3. Check Pushgateway: `curl http://localhost:9091/api/v1/metrics`

**Gate/failure rate shows 0**

- Verify GitHub API access: `gh api rate_limit`
- Check `gh pr list --state merged --limit 5` returns data
- Ensure `gh api repos/zone17/sovren/actions/runs` succeeds

**Agent cycle times empty**

- Check `~/.claude/metrics/ce-events.jsonl` for `agent_complete` events
- Verify `agent-complete.sh` hook is registered in `~/.claude/settings.json`

**Coverage delta shows "No baseline yet"**

- Merge a PR that ran tests with coverage (`npm run test:coverage`)
- Baseline auto-creates via `post-git-actions.sh` after `gh pr merge`

## Deferred Metrics (documented, not built)

| Metric                     | Why Deferred                                 | Prerequisite                                     |
| -------------------------- | -------------------------------------------- | ------------------------------------------------ |
| Agent Lead Time            | pr_create events lack PR number              | Build when data pipeline exists                  |
| Queue Wait Time            | No TaskCreated/TaskUpdated hooks             | Claude Code feature request                      |
| Revision Loops             | Commit count is broken proxy                 | Use `gh pr --json reviews` when data accumulates |
| Guardrail Triggers (panel) | Near-zero for solo dev                       | Panel when data accumulates                      |
| Standards Compliance       | Hooks already enforce — metric is a constant | Nothing to build                                 |
| Rework Ratio               | Commit count penalizes good git practice     | Per-commit diff comparison (expensive)           |
| Defect Origin              | Branch prefix != defect origin               | review_findings events from /workflows:review    |
