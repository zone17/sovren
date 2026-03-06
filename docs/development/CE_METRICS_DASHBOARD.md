# CE Metrics Dashboard

Track Compound Engineering session metrics across **5 dimensions**: Cost Efficiency, Velocity, Quality, Knowledge Compounding, and Agent Efficiency.

## Architecture

```
Claude Code Hooks → JSONL → session-end.sh → Pushgateway → Prometheus → Grafana
                              ↑
Workflow Hooks → set-phase.sh ┘ (preserves session_id/branch in ce-phase.json)
```

Hooks fire on lifecycle events (session start/end, turns, agent spawn/complete, git commands, task completion). Events append to `~/.claude/metrics/ce-events.jsonl`. At session end, `session-end.sh` aggregates all events and pushes ~20 metrics to Pushgateway.

Workflow commands (`/workflows:plan`, `/workflows:work`, etc.) call `set-phase.sh` to update the current CE phase without overwriting session metadata.

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

### Verify with Seed Data

```bash
# Push synthetic metrics for 3 PRs across all 5 dimensions
bash scripts/ce-metrics/seed-test-data.sh

# Open Grafana
open http://localhost:3002
```

All 22 panels should render with data (no "No data" panels).

### Verify with Real Session

Run a Claude Code session with `/workflows:plan`. After the session ends:

1. Check `~/.claude/metrics/ce-events.jsonl` — events should have correct `phase` (not all `adhoc`)
2. Check `~/.claude/metrics/ce-phase.json` — should have `session_id`, `branch`, `pr_number`
3. Metrics appear in Grafana within 5 minutes (dashboard refresh interval)

## 5 Dimensions

### 1. Cost Efficiency

How much does each session/PR cost?

| Metric                              | Type  | Description                                                                   |
| ----------------------------------- | ----- | ----------------------------------------------------------------------------- |
| `ce_session_cost_usd`               | gauge | Multi-model session cost (Opus $15/$75, Sonnet $3/$15, Haiku $0.80/$4 per 1M) |
| `ce_session_tokens_total{type}`     | gauge | Token usage by type (input, output, cache_read, cache_creation)               |
| `ce_session_tokens_by_model{model}` | gauge | Per-model token breakdown                                                     |

### 2. Velocity

How fast are sessions completing?

| Metric                   | Type  | Description                    |
| ------------------------ | ----- | ------------------------------ |
| `ce_session_turns_total` | gauge | Number of API turns in session |

### 3. Quality

What is the defect density?

| Metric                        | Type  | Description                              |
| ----------------------------- | ----- | ---------------------------------------- |
| `ce_findings_total{severity}` | gauge | Review findings by severity (p1, p2, p3) |
| `ce_lines_changed{type}`      | gauge | Lines added/deleted vs origin/main       |

### 4. Knowledge Compounding

Is the team getting smarter?

| Metric                   | Type  | Description                                                 |
| ------------------------ | ----- | ----------------------------------------------------------- |
| `ce_compound_docs_total` | gauge | Count of docs in `docs/solutions/`                          |
| `ce_pattern_count`       | gauge | Line count of `common-solutions.md` (pattern density proxy) |

### 5. Agent Efficiency

Are agents productive?

| Metric                          | Type  | Description                   |
| ------------------------------- | ----- | ----------------------------- |
| `ce_session_agents_total`       | gauge | Agents spawned per session    |
| `ce_session_tasks_total`        | gauge | Tasks completed per session   |
| `ce_session_commits_total`      | gauge | Git commits per session       |
| `ce_agent_duration_seconds_avg` | gauge | Average agent completion time |

**All metrics include labels:** `session`, `phase`, `project`, `pr_number`

## Dashboard Panels (22 panels, 7 rows)

### Row 0: Executive KPIs (6 panels)

- **Total Cost** — aggregate USD
- **Cost Trend** — sparkline per session
- **PRs Tracked** — distinct PR count
- **Avg Turns/Session** — velocity indicator
- **P1 Findings** — critical defect count with sparkline
- **Cache Efficiency** — cache_read / (input + cache_read) gauge

### Row 1: Cost Efficiency (4 panels)

- **Cost per Session** — bar chart
- **Cost by Phase** — pie chart (plan/work/review/compound/adhoc)
- **Cost by Model** — pie chart (opus/sonnet/haiku)
- **Token Composition** — bar gauge (input/output/cache_read/cache_creation)

### Row 2: Velocity (3 panels)

- **Turns per Session** — bar chart
- **Turns by Phase** — pie chart
- **Avg Agent Duration** — stat with trend

### Row 3: Quality (3 panels)

- **Findings by Severity** — stacked bar (P1/P2/P3)
- **P1 Findings per Session** — bar chart
- **Lines Changed per Session** — stacked bar (added/deleted)

### Row 4: Knowledge Compounding (2 panels)

- **Compound Docs** — stat with trend
- **Pattern Count** — stat with trend

### Row 5: Agent Efficiency (3 panels)

- **Agents per Session** — bar chart
- **Tasks per Session** — bar chart
- **Commits per Session** — bar chart

### Row 6: Active Session (3 panels)

- **Current Phase** — plan/work/review/compound/brainstorm/adhoc
- **Session Cost** — USD estimate
- **Tokens This Session** — total tokens

## Configuration

| Setting             | Location                      | Default                 |
| ------------------- | ----------------------------- | ----------------------- |
| Pushgateway URL     | `PUSHGATEWAY_URL` env var     | `http://localhost:9091` |
| Grafana port        | `docker-compose.dev.yml`      | 3002                    |
| Dashboard refresh   | `ce-metrics-main.json`        | 5 minutes               |
| JSONL rotation      | lib.sh `rotate_jsonl()`       | 10MB                    |
| Pending file expiry | lib.sh `replay_pending()`     | 24 hours                |
| Disable metrics     | `~/.claude/metrics/.disabled` | enabled                 |

## Troubleshooting

**No data in Grafana**

1. Run `bash scripts/ce-metrics/seed-test-data.sh` to push synthetic data
2. Run `bash scripts/ce-metrics/check-health.sh`
3. Check Pushgateway has data: `curl http://localhost:9091/api/v1/metrics`
4. Check Prometheus targets: `http://localhost:9090/targets`
5. Check `~/.claude/metrics/ce-events.jsonl` has entries

**All events show phase "adhoc"**

- Verify workflow hooks call `set-phase.sh` (not inline `echo`)
- Check `~/.claude/hooks/ce-metrics/set-phase.sh` exists and is executable
- Verify `~/.claude/metrics/ce-phase.json` has `session_id` field (set-phase.sh preserves it)

**Token data is all zeros**

- Check `turn-complete.sh` is registered in settings.json
- Verify transcript path is accessible: `cat ~/.claude/metrics/ce-events.jsonl | jq 'select(.type=="turn_complete")'`
- Transcript format may vary — check `parse_last_turn_tokens()` in lib.sh

**Cost seems wrong**

- `compute_cost()` uses multi-model pricing — verify model names in JSONL match patterns (opus/sonnet/haiku)
- Unknown models default to Opus pricing

**Metrics disabled**

```bash
rm ~/.claude/metrics/.disabled
```

**Stale pending files**

```bash
rm -f ~/.claude/metrics/pending/*.prom ~/.claude/metrics/pending/*.meta
```

## Hook API Reference

| Hook Event        | Script            | Trigger                                       |
| ----------------- | ----------------- | --------------------------------------------- |
| SessionStart      | session-start.sh  | Session begins (creates ce-phase.json)        |
| Stop              | turn-complete.sh  | Each API turn completes                       |
| SubagentStart     | agent-spawn.sh    | Agent spawned                                 |
| SubagentStop      | agent-complete.sh | Agent completes                               |
| PostToolUse[Bash] | git-event.sh      | After any Bash tool call                      |
| TaskCompleted     | task-complete.sh  | Task marked complete                          |
| SessionEnd        | session-end.sh    | Session ends (aggregates + pushes)            |
| Workflow hooks    | set-phase.sh      | Phase transition (preserves session metadata) |

## Deferred Metrics (Phase 2)

These require infrastructure beyond session hooks:

- Line survival rate (30-day git blame — needs cron)
- Rework rate (cross-PR change detection — needs backfill script)
- CI recovery time (GitHub Actions API — needs polling)
- Test coverage delta (coverage report parsing)
- PRs merged per day (GitHub API or webhook)
