---
title: 'feat: CE Metrics Dashboard — Live Engineering Intelligence'
type: feat
date: 2026-03-04
deepened: 2026-03-04
---

## Enhancement Summary

**Deepened on:** 2026-03-04
**Research agents used:** Architecture Strategist, Performance Oracle, Prometheus Backfill Researcher, Grafana Dashboard Researcher
**Sections enhanced:** All 4 phases + cross-cutting concerns

### Key Improvements from Deepening

1. **P1 Performance fix**: `session-end.sh` must aggregate from `ce-events.jsonl` (140KB) NOT re-parse transcript (up to 723MB). Use `tail -1` + `jq` instead of `python3 -c` for per-turn parsing (~50ms saved per turn)
2. **Version hooks in repo**: Canonical copies at `scripts/ce-metrics/hooks/` with bootstrap install script — hooks outside VCS is an operational risk
3. **Pushgateway stale data**: Add cleanup + replay mechanism for failed pushes (pending directory pattern)
4. **Add `project` label from day 1**: Costs nothing now, avoids migration when multi-project support needed
5. **Docker resource limits**: Prometheus 512MB, Grafana 256MB, Pushgateway 64MB
6. **Test harness**: `scripts/ce-metrics/test-hooks.sh` for isolated hook testing without running Claude Code
7. **PromQL patterns**: Avoid `rate()`, `increase()`, `sum_over_time()` on pushgateway gauges — use `sum()`, `last_over_time()`, `delta()`
8. **JSONL rotation**: `ce-events.jsonl` grows unbounded — add daily rotation via `session-start.sh` (rotate when >10MB)
9. **JSONL filtering**: Use `jq` instead of `grep` for session filtering — structured query over string matching

### Cross-Cutting Concerns Discovered

- Phase detection silent degradation: if CE plugin disabled, all events tagged "adhoc" with no signal. Add validation in `session-end.sh`
- Two Prometheus configs in repo (`docker/prometheus/` vs `monitoring/`): consolidate or explicitly separate
- Pushgateway semantic mismatch: cached values re-scraped every 15s. Need cleanup of stale session metrics
- No integration test defined concretely: need scripted end-to-end pipeline verification
- JSONL atomicity: `>>` is atomic under PIPE_BUF but prescribe `{ printf '%s\n' "$json"; } >> "$file"` for defense-in-depth

# feat: CE Metrics Dashboard — Live Engineering Intelligence

## Overview

Build a live Grafana dashboard powered by Prometheus that tracks all 5 dimensions of Compound Engineering effectiveness — **Cost Efficiency, Velocity, Quality, Knowledge Compound Rate, and Agent Efficiency** — with project-level totals, per-PR granularity, and trend analysis. Data collection is fully automated via Claude Code hooks embedded in existing CE workflows.

**Design Source**: `docs/brainstorms/2026-03-04-ce-metrics-dashboard-brainstorm.md` (1,698 lines, fully resolved — all open questions answered)

## Problem Statement

After 50+ sprints using the CE loop, we have zero quantitative visibility into engineering effectiveness:

- **Cost**: No idea how much each PR costs in tokens/USD, or which CE phase burns the most
- **Velocity**: No trending on time-to-merge or phase duration — can't tell if the loop is getting faster
- **Quality**: P1/P2/P3 counts exist in compound docs but aren't aggregated or trended
- **Knowledge**: Can't measure whether documented patterns actually prevent re-investigation
- **Agents**: No data on optimal team size, respawn rates, or conflict rates over time

Current metrics in compound docs are process-oriented narratives. They tell you _what happened_ but not _how efficiently_ or _whether you're improving_.

## Proposed Solution

A 3-phase implementation deploying the live observability stack:

1. **Docker monitoring stack** (Prometheus, Grafana, Pushgateway) added to `docker-compose.dev.yml`
2. **Hook infrastructure** (7 bash scripts in `~/.claude/hooks/ce-metrics/`) collecting events to JSONL + pushgateway
3. **Grafana dashboard** (~18 panels across 6 rows) with file-provisioned JSON, template variables, and drill-down

## Technical Approach

### Architecture

```
Claude Code Session
    │
    ├── SessionStart hook ──→ Write ce-phase.json (CE phase detection)
    │
    ├── Stop hook (async) ──→ Parse last turn tokens → append ce-events.jsonl
    │
    ├── SubagentStart/Stop ──→ Track agent spawns, tokens, duration
    │
    ├── PostToolUse[Bash] ──→ Detect git commit/push/merge events
    │
    ├── TaskCompleted ──→ Task resolution tracking
    │
    └── SessionEnd ──→ Aggregate session totals → POST to Pushgateway
                                                         │
                                                         ▼
                                                    Prometheus
                                                    (scrapes pushgateway @ 15s)
                                                         │
                                                         ▼
                                                    Grafana
                                                    (~18 panels, 5 dimensions,
                                                     template variables)
```

### Key Design Decisions

| Decision           | Choice                                           | Rationale                                                                        |
| ------------------ | ------------------------------------------------ | -------------------------------------------------------------------------------- |
| Dashboard platform | Grafana                                          | Anthropic's recommendation; existing prom-client infra                           |
| Data collection    | Claude Code hooks                                | Zero manual input; fires on workflow events                                      |
| Sprint boundary    | PR-based                                         | Matches compound doc cadence; auto-detected from git                             |
| Storage            | Prometheus TSDB                                  | 90-day retention; handles time series natively                                   |
| Phase detection    | Skill-scoped hooks                               | 100% accurate; `once: true` in skill frontmatter                                 |
| Concurrent writes  | Append-only JSONL with `>>`                      | Shell `>>` is atomic for lines <PIPE_BUF (4096 bytes); our events are ~200 bytes |
| Deployment scope   | Global user settings (`~/.claude/settings.json`) | Track all projects, not just Sovren                                              |

### Prometheus Metric Names

**Built-in (from Claude Code OTEL)**:

```
claude_code_token_usage_tokens_total{type, model}
claude_code_cost_usage_USD_total{model}
claude_code_active_time_seconds_total{type}
claude_code_lines_of_code_count_total{type}
claude_code_session_count_total
claude_code_commit_count_total
```

**CE-specific (from our hooks)**:

```
ce_session_cost_usd{pr_number, model, session}
ce_phase_duration_seconds{phase, pr_number}
ce_findings_total{severity, pr_number}
ce_agent_spawn_total{agent_type, phase}
ce_agent_duration_seconds{agent_type, agent_id}
ce_agent_tokens_total{agent_type, token_type}
ce_task_completed_total{team_name}
ce_pattern_reuse_total{pattern_id}
ce_stale_todo_total{pr_number}
ce_review_rounds_total{pr_number}
ce_merge_conflict_total{team_name}
ce_agent_respawn_total{agent_type}
ce_pr_merged_total{pr_number, branch}
```

### File Structure

```
# Repository files (version-controlled)
monitoring/
├── grafana/
│   ├── provisioning/
│   │   ├── dashboards/
│   │   │   └── dashboards.yml              # Provider config
│   │   └── datasources/
│   │       └── datasources.yml             # Prometheus datasource
│   └── dashboards/
│       └── ce-metrics-main.json            # Primary 5-dimension dashboard (~18 panels)
└── prometheus.yml                           # Scrape config (pushgateway + self)

scripts/ce-metrics/
├── hooks/                                   # Canonical copies (version-controlled)
│   ├── lib.sh                              # Shared functions — deployed to ~/.claude/hooks/ce-metrics/
│   ├── session-start.sh
│   ├── turn-complete.sh
│   ├── agent-spawn.sh
│   ├── agent-complete.sh
│   ├── git-event.sh
│   ├── task-complete.sh
│   └── session-end.sh
├── install-hooks.sh                         # Bootstrap: copy hooks + patch settings.json
├── test-hooks.sh                            # Test harness: synthetic hook invocations
└── seed-test-data.sh                        # Push synthetic metrics for dashboard verification

# User-local files (NOT version-controlled)
~/.claude/hooks/ce-metrics/
├── lib.sh                                   # Shared functions
├── session-start.sh                         # Phase detection
├── turn-complete.sh                         # Per-turn tokens (async)
├── agent-spawn.sh                           # Agent tracking (async)
├── agent-complete.sh                        # Agent completion + tokens
├── git-event.sh                             # Git event detection (async)
├── task-complete.sh                         # Task tracking (async)
└── session-end.sh                           # Session aggregation → pushgateway

~/.claude/metrics/
├── ce-events.jsonl                          # Append-only event log
└── ce-phase.json                            # Current phase state
```

### Implementation Phases

#### Phase 1: Docker Monitoring Stack (Foundation)

**Goal**: Get Prometheus + Grafana + Pushgateway running locally with health checks and provisioning scaffolding.

**Tasks and deliverables**:

- [ ] Create `monitoring/` directory structure (see File Structure above)
- [ ] Create `monitoring/prometheus.yml` — scrape config targeting pushgateway at `pushgateway:9091` + self-scrape
- [ ] Create `monitoring/grafana/provisioning/datasources/datasources.yml` — Prometheus datasource at `http://prometheus:9090`
- [ ] Create `monitoring/grafana/provisioning/dashboards/dashboards.yml` — provider config with `allowUiUpdates: true`, `updateIntervalSeconds: 10`
- [ ] Create placeholder `monitoring/grafana/dashboards/ce-metrics-main.json` — empty dashboard with correct UID (`ce-metrics-main`), title, and template variables
- [ ] Add 3 services to `docker-compose.dev.yml`:
  - `prometheus` — image `prom/prometheus:latest`, port `127.0.0.1:9090:9090`, volume for config + data, retention flags (`--storage.tsdb.retention.time=90d`, `--storage.tsdb.retention.size=1GB`), **resource limit: 512MB memory**
  - `grafana` — image `grafana/grafana:latest`, port `127.0.0.1:3002:3000`, volumes for provisioning + dashboards, anonymous auth enabled, env vars, **resource limit: 256MB memory**
  - `pushgateway` — image `prom/pushgateway:latest`, port `127.0.0.1:9091:9091`, **resource limit: 64MB memory**
  - All services use `deploy.resources.limits.memory` to prevent OOM from runaway queries
- [ ] Consolidate or separate Prometheus configs: existing `docker/prometheus/prometheus.yml` (MCP stack) vs new `monitoring/prometheus.yml` (CE stack). **Decision: keep separate** — CE stack is independent of MCP. Use distinct service name `ce-prometheus` if both run simultaneously
- [ ] Add Docker network `ce-monitoring` (bridge) for service isolation. Document that CE monitoring is intentionally NOT on `sovren-dev` network
- [ ] Add named volumes for Prometheus data and Grafana data persistence
- [ ] Add health checks to all 3 services
- [ ] Verify: `docker compose -f docker-compose.dev.yml up prometheus grafana pushgateway` starts cleanly
- [ ] Verify: Grafana accessible at `http://localhost:3002` with Prometheus datasource connected
- [ ] Verify: Pushgateway accessible at `http://localhost:9091`
- [ ] Add `monitoring/grafana/data/` and Docker volumes to `.gitignore`

**Success criteria**:

- All 3 services start, pass health checks, and auto-connect
- Grafana shows Prometheus as a connected datasource with green status

**Estimated effort**: Small (1-2 hours)

---

#### Phase 2: Hook Infrastructure (Data Collection)

**Goal**: Deploy 7 hook scripts that collect CE metrics events from every Claude Code session.

**Tasks and deliverables**:

- [ ] Create `~/.claude/hooks/ce-metrics/` directory
- [ ] Implement `lib.sh` — shared functions:
  - `get_phase()` — read `~/.claude/metrics/ce-phase.json` using **`jq -r '.phase // "adhoc"'`** (not python3 — jq is 5-10x faster for a ~100 byte file). Python3 fallback if jq unavailable
  - `emit_event()` — append JSON line to `~/.claude/metrics/ce-events.jsonl` using `{ printf '%s\n' "$json"; } >> "$file"` (defense-in-depth over bare `echo >>`). **Include `"project"` label derived from `cwd`** (e.g., basename of git root) in every event from day 1 — avoids migration when multi-project support needed
  - `parse_last_turn_tokens()` — **P1 FIX: use `tail -1 "$transcript" | jq -c`** instead of `python3 -c "for line in f: pass"`. The python approach reads the ENTIRE file (O(n)), tail uses O(1) seek. For a 50MB transcript this saves ~150ms per turn and ~17.5GB cumulative I/O per session
  - `emit_git_event()` — pattern-match git commands, extract verb only (NEVER log full command)
  - `sanitize_subject()` — strip potential secrets from task subjects
  - Disable check: `[ -f "$HOME/.claude/metrics/.disabled" ] && exit 0` at top of every script
  - **Fast-exit guard for PostToolUse[Bash]**: check `tool_name == "Bash"` before any processing — other tool types should exit immediately
  - Security rules: NEVER read `tool_input`, `tool_result`, or message content — **sole exception**: `git-event.sh` reads the first 2 words of `tool_input.command` via `case` prefix match to classify git verbs. The full command is never stored or logged
- [ ] Implement `session-start.sh`:
  - Read input JSON for `session_id`, `cwd`
  - Write `ce-phase.json` with `session_id`, `phase: "adhoc"`, `started_at`, `branch` (from `git branch --show-current`)
  - **JSONL rotation**: If `ce-events.jsonl` > 10MB, move to `ce-events.jsonl.1` (keep only 1 archive). This prevents unbounded growth while preserving recent history for session-end aggregation
  - Sync, timeout: 5s
- [ ] Implement `turn-complete.sh`:
  - Read input JSON for `session_id`, `transcript_path`
  - Call `parse_last_turn_tokens()` on transcript
  - Emit `turn_complete` event with tokens, model, phase, turn cost estimate
  - **Async**: `true`, timeout: 10s
- [ ] Implement `agent-spawn.sh`:
  - Read input JSON for `session_id`, `agent_id`, `agent_type`
  - Emit `agent_spawn` event with phase context
  - Async: `true`, timeout: 5s
- [ ] Implement `agent-complete.sh`:
  - Read input JSON for `session_id`, `agent_id`, `agent_type`, `agent_transcript_path`
  - Parse agent transcript for total tokens (all assistant turns)
  - Compute duration from first to last timestamp
  - Emit `agent_complete` event with tokens, duration, turns
  - Sync (fires once per agent), timeout: 15s
- [ ] Implement `git-event.sh`:
  - Read input JSON for `session_id`. Read `tool_input.command` ONLY via `case` prefix match — extract the verb (`git commit`, `git push`, `gh pr merge`, `gh pr create`) and discard the rest. **This is the sole exception** to the "never read tool_input" rule — we read only the first 2 words to classify the event
  - Emit: `git_commit`, `git_push`, `pr_merge`, `pr_create`
  - Extract PR number from `gh pr merge` output if available
  - NEVER log the full command string — only the classified verb
  - Async: `true`, timeout: 5s
- [ ] Implement `task-complete.sh`:
  - Read input JSON for `session_id`, `task_id`, `task_subject`, `teammate_name`, `team_name`
  - Sanitize task subject
  - Emit `task_complete` event
  - Async: `true`, timeout: 5s
- [ ] Implement `session-end.sh`:
  - Read input JSON for `session_id`, `transcript_path`, `reason`
  - **P1 FIX: Aggregate from `ce-events.jsonl` (~140KB), NOT re-parse transcript (up to 723MB)**. Per-turn token data was already captured by `turn-complete.sh` into the events file. Session-end aggregates: `jq -c "select(.session_id == \"$SESSION_ID\")" "$EVENTS_FILE" | jq -s` (structured query, not `grep` on JSON)
  - Count agents, tasks, commits from same events file
  - **Add curl timeouts**: `curl --connect-timeout 2 --max-time 5 --fail --silent --data-binary @-`
  - **Add replay for failed pushes**: If curl fails, save payload to `~/.claude/metrics/pending/session-$SESSION_ID.prom`. On next successful session-end, replay pending payloads
  - **Add Pushgateway stale cleanup**: After pushing current session, delete previous session's metrics: `curl -s -X DELETE "http://localhost:9091/metrics/job/ce_session/session/$PREV_SESSION_ID"`
  - **Add phase detection validation**: If >90% of events tagged "adhoc" but session invoked CE skills (detectable from event types), log warning
  - Sync, timeout: **60s** (increased from 30s to accommodate replay + cleanup)
- [ ] Register all hooks in `~/.claude/settings.json` (additive — preserve existing hooks):
  - `SessionStart`: `session-start.sh`
  - `Stop`: `turn-complete.sh` (async)
  - `SubagentStart`: `agent-spawn.sh` (async)
  - `SubagentStop`: `agent-complete.sh` (sync)
  - `PostToolUse[Bash]`: `git-event.sh` (async)
  - `TaskCompleted`: `task-complete.sh` (async) — added alongside existing `verify-task-complete.sh`
  - `SessionEnd`: `session-end.sh` (sync)
- [ ] **Version hook scripts in repo** at `scripts/ce-metrics/hooks/` (canonical copies). Create `scripts/ce-metrics/install-hooks.sh` bootstrap that copies hooks to `~/.claude/hooks/ce-metrics/` and patches `settings.json`. Hooks outside VCS cannot be reviewed in PRs, rolled back, or shared across machines
- [ ] Create `scripts/ce-metrics/test-hooks.sh` — test harness that simulates Claude Code hook invocations with synthetic JSON input. Tests: happy path per hook, missing/malformed input, missing phase file (adhoc fallback), Pushgateway unavailable (graceful degradation), concurrent writes (parallel hook test)
- [ ] Create `scripts/ce-metrics/seed-test-data.sh` — push synthetic metrics to Pushgateway for dashboard verification without real session data
- [ ] Add CE phase detection hooks to skill frontmatter for `plan.md`, `work.md`, `review.md`, `compound.md`:
  ```yaml
  hooks:
    SessionStart:
      - hooks:
          - type: command
            command: echo '{"phase":"<PHASE>","started_at":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' > ~/.claude/metrics/ce-phase.json
            once: true
  ```
- [ ] Test: Run a short Claude Code session → verify `ce-events.jsonl` has turn_complete events
- [ ] Test: Run `/workflows:review` → verify agent_spawn and agent_complete events appear
- [ ] Test: Make a `git commit` → verify `git_commit` event appears
- [ ] Test: End session → verify Pushgateway shows session summary metrics

**Success criteria**:

- All 7 hooks fire correctly on their respective events
- `ce-events.jsonl` accumulates events with correct schema
- Pushgateway receives session summary on session end
- No existing hooks broken (auto-commit-config, verify-task-complete, check-teammate-done)
- Hook latency within performance budget (see brainstorm)

**Estimated effort**: Medium (3-4 hours)

**Known risks**:

- JSONL concurrent writes from parent + subagent sessions: mitigated by `>>` append being atomic for lines < PIPE_BUF (4096 bytes on macOS/Linux). Each event is ~200 bytes
- Pushgateway unavailable: `session-end.sh` should `curl --fail --silent` and log error to stderr without blocking exit

---

#### Phase 3: Grafana Dashboard (Visualization)

**Goal**: Build the 30-panel, 7-row dashboard with template variables and drill-down interaction.

**Tasks and deliverables**:

- [ ] Create `monitoring/grafana/dashboards/ce-metrics-main.json` with:
  - **Dashboard metadata**: `uid: "ce-metrics-main"`, `schemaVersion: 39`, `graphTooltip: 1` (shared crosshair), `refresh: "30s"`
  - **Template variables** (top bar):
    - `$project` — `type: "custom"`, `query: "Sovren"`, `hide: 0`
    - `$pr` — `type: "query"`, `datasource: prometheus`, `query: "label_values(ce_session_cost_usd, pr_number)"`, `includeAll: true`, `allValue: ".*"`, `sort: 3` (numeric desc)
    - `$phase` — `type: "custom"`, `query: "plan,work,review,compound,adhoc"`, `includeAll: true`, `multi: true`
    - `$model` — `type: "query"`, `query: "label_values(ce_session_cost_usd, model)"`, `includeAll: true`, `multi: true`
    - `$timeRange` — interval: `5m,15m,1h,6h,12h,1d,7d,30d,90d`, default "30d"
  - **PromQL patterns for pushgateway gauges** (critical — avoid common pitfalls):
    - Use `sum()`, `sum by()` for instant aggregations
    - Use `last_over_time(metric[24h])` for sparse data with wide lookback
    - Use `delta()` for gauge changes (NOT `increase()`)
    - **NEVER use** `rate()`, `increase()`, or `sum_over_time()` on pushgateway gauges — they produce wrong results because Prometheus re-scrapes cached values every 15s
  - **Row 1: Project-Level KPIs** (4 stat panels):
    - Total Cost (stat), PRs Merged (stat), Avg Time-to-Merge (stat), P1 Count (stat)
  - **Row 2: Cost Efficiency** (3 panels):
    - Cost per PR (bar chart), Cost by CE Phase (pie), Cost by Model (pie)
  - **Row 3: Velocity** (3 panels):
    - Time-to-Merge Trend (time series), Phase Duration Breakdown (stacked bar), Review Rounds per PR (bar)
  - **Row 4: Quality** (3 panels):
    - Findings by Severity (stacked bar), P1 Rate Over Time (time series), Finding Rate per 1K LOC (time series)
  - **Row 5: Knowledge & Agents** (3 panels — combines dimensions 4+5):
    - Stale Todo Rate (gauge), Agent Respawn Rate (gauge), Merge Conflict Streak (stat)
  - **Row 6: Active Session** (3 panels — visible during active sessions):
    - Current Session Cost (stat), Current Phase (stat), Tokens This Session (stat)
  - **Drill-down links**: Click PR number → sets `$pr` variable; click phase → sets `$phase`
  - **Color palette**: Phase colors: blue/green/orange/purple/gray; Model colors: gold/silver/bronze
- [ ] Verify: Start monitoring stack → Grafana loads dashboard with all panels
- [ ] Verify: Template variables cascade correctly (select PR → all panels filter)

**Success criteria**:

- All ~19 panels render with correct queries (empty data is OK at this stage)
- Template variables work for drill-down
- Dashboard JSON is version-controlled and hot-reloads on file changes

**Estimated effort**: Medium (3-4 hours — dashboard JSON is verbose)

---

## Alternative Approaches Considered

| Approach                                     | Why Rejected                                                                                        |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Custom web dashboard (React)                 | Reinvents visualization; Grafana is purpose-built for time series                                   |
| SQLite storage instead of Prometheus         | Loses time series optimizations and PromQL                                                          |
| API key-based token tracking (Anthropic API) | Claude Code provides local JSONL data; no API key needed                                            |
| OTEL Collector filelog receiver              | Adds complexity; Pushgateway is simpler for MVP. Filelog is a future upgrade for sub-minute updates |
| Per-hook OTEL span export                    | Over-engineered for shell scripts; JSONL append + pushgateway is simpler                            |
| Cloud-hosted Grafana                         | Violates local-only principle; unnecessary for single-developer use                                 |

## Acceptance Criteria

### Functional Requirements

- [ ] `docker compose up prometheus grafana pushgateway` starts 3 healthy services
- [ ] Grafana accessible at `http://localhost:3002` with no login required
- [ ] Prometheus shows connected datasource in Grafana
- [ ] All 7 hooks registered in `~/.claude/settings.json` and fire correctly
- [ ] `ce-events.jsonl` accumulates events during normal Claude Code use
- [ ] Session summary pushed to Pushgateway on session end
- [ ] Grafana dashboard loads with ~19 panels across 6 rows
- [ ] Template variables (`$pr`, `$phase`, `$model`) filter all panels correctly
- [ ] `touch ~/.claude/metrics/.disabled` stops all metric collection
- [ ] Existing hooks (auto-commit, verify-task, check-teammate) still function

### Non-Functional Requirements

- [ ] Hook overhead: <0ms per turn (async hooks), <10s per session end
- [ ] Docker services: <500MB total memory usage
- [ ] Prometheus retention: 90 days, capped at 1GB disk
- [ ] All ports bound to `127.0.0.1` (no network exposure)
- [ ] Hooks NEVER read message content, tool inputs/outputs, or file contents — only numeric metadata
- [ ] `ce-events.jsonl` events are <200 bytes each (under PIPE_BUF for atomic `>>`)

### Quality Gates

- [ ] All hook scripts pass `shellcheck`
- [ ] Grafana dashboard JSON valid (loads without errors)
- [ ] Integration test: run 1 session → verify full pipeline (hooks → JSONL → pushgateway → Prometheus → Grafana)

## Success Metrics

| Metric              | Target              | Measurement                                    |
| ------------------- | ------------------- | ---------------------------------------------- |
| Dashboard load time | <3s                 | Grafana built-in metrics                       |
| Hook failure rate   | <1%                 | Count errors in hook stderr logs               |
| Adoption friction   | 1 command to enable | `docker compose up` + hooks already registered |

## Dependencies & Prerequisites

| Dependency                         | Status   | Risk                                    |
| ---------------------------------- | -------- | --------------------------------------- |
| Docker Desktop running             | Required | Low — already used for backend dev      |
| Claude Code hooks API              | Stable   | Low — using documented hook types       |
| `~/.claude/settings.json` writable | Required | Low — hooks already configured          |
| Pushgateway port 9091 available    | Required | Low — not used by any service           |
| Port 3002 available for Grafana    | Required | Low — port 3002 not used by any service |

**Port 3001 conflict**: The `docker-compose.dev.yml` maps `backend-dev` to port 3001. Grafana needs a different port. **Resolution**: Use port `3002` for Grafana (`127.0.0.1:3002:3000`) to avoid conflict with backend dev server. Update all references.

## Risk Analysis & Mitigation

| Risk                                         | Probability | Impact | Mitigation                                                                                                           |
| -------------------------------------------- | ----------- | ------ | -------------------------------------------------------------------------------------------------------------------- |
| Hook latency affects UX                      | Low         | High   | All high-frequency hooks are `async: true`                                                                           |
| JSONL concurrent write corruption            | Very Low    | Medium | Events <200 bytes (under PIPE_BUF); `>>` is atomic. Use `{ printf '%s\n' "$json"; } >> "$file"` for defense-in-depth |
| Pushgateway down when session ends           | Low         | Low    | `curl --fail --silent`; data still in JSONL for manual recovery                                                      |
| Grafana dashboard JSON too large to maintain | Medium      | Low    | `allowUiUpdates: true` — edit in UI, export JSON to repo                                                             |
| Hook scripts break existing hooks            | Very Low    | High   | Additive registration; metrics hooks never return decisions (block/deny)                                             |
| Privacy: hooks accidentally log secrets      | Very Low    | High   | Security rules enforced in `lib.sh`; `emit_git_event` uses `case` not regex; task subjects sanitized                 |
| JSONL grows unbounded                        | Medium      | Low    | Rotate in `session-start.sh` when >10MB; archive to `ce-events.jsonl.1`                                              |

## Future Considerations

- **Historical backfill**: Parse 37 JSONL transcript files + MEMORY.md sprint entries → `promtool tsdb create-blocks-from openmetrics` for 19 days of historical data. Deferred — live data is sufficient for MVP
- **Alerting**: Grafana file-provisioned alerting with three-stage A→B→C pattern (Prometheus query → Reduce → Threshold). Deferred — dashboard visual inspection is sufficient for solo developer
- **OTEL Collector filelog receiver**: Tail `ce-events.jsonl` for sub-minute dashboard updates (currently relies on pushgateway at session end)
- **Multi-project support**: `$project` template variable already defined; add project label to hook events
- **Grafana Cloud**: If team metrics needed, push to cloud instance (opt-in per developer)
- **Agent detail sub-dashboard**: Dedicated drill-down for per-agent token analysis

## Documentation Plan

- [ ] Update `docs/PROJECT_CONTEXT.md` section 3 (Architecture) to add monitoring stack
- [ ] Add monitoring commands to section 5 (Commands Cheatsheet)
- [ ] Create `docs/development/CE_METRICS_DASHBOARD.md` with:
  - Quick start guide (enable/disable)
  - Dashboard walkthrough
  - Troubleshooting
- [ ] Update `CLAUDE.md` Docker Operations section to include monitoring services

## References & Research

### Internal References

- Design: `docs/brainstorms/2026-03-04-ce-metrics-dashboard-brainstorm.md`
- Existing monitoring: `packages/backend/src/middleware/deployment-monitoring.ts:1` (prom-client v15)
- Existing Prometheus config: `docker/prometheus/prometheus.yml:1`
- Existing Prometheus rules (reference): `docker/prometheus/mcp_rules.yml:1`
- Existing hooks: `~/.claude/settings.json` (3 hooks)
- Hook disaster learning: `docs/solutions/process-issues/p2-remediation-r5-hook-disaster-domain-agents-20260220.md` (common-solutions #15)
- Hook migration: `docs/solutions/infrastructure-issues/pr90-hook-migration-security-test-enforcement-20260221.md` (common-solutions #17, #18)

### External References

- Anthropic monitoring guide: [claude-code-monitoring-guide](https://github.com/anthropics/claude-code-monitoring-guide)
- Community implementation: [mikelane/claude-code-metrics](https://gist.github.com/mikelane/9bf3053b5608df5858d299d636a48e8f)
- Grafana dashboard best practices: [grafana.com/docs](https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/best-practices/)
- Grafana alerting best practices: [grafana.com/docs](https://grafana.com/docs/grafana/latest/alerting/guides/best-practices/)
- Prometheus backfill docs: [prometheus.io/docs/storage](https://prometheus.io/docs/prometheus/latest/storage/)
- Prometheus Pushgateway: [github.com/prometheus/pushgateway](https://github.com/prometheus/pushgateway)

### Patterns Applied

- common-solutions.md #15: Task hooks must NOT run full quality gates
- common-solutions.md #17: Hook migration checklist
- common-solutions.md #18: Never suppress test runner errors in hooks
- common-solutions.md #81: Blob download via apiClient (analogous: structured data extraction from hooks)
- common-solutions.md #82: Loading state must not hide structural UI (analogous: hooks must not block UX)

### SpecFlow Gaps Addressed

From the SpecFlow analysis, these valid gaps are addressed in this plan:

| Gap                                            | Resolution                                                                                                             |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Concurrent JSONL writes from parent + subagent | `>>` append is atomic for lines <PIPE_BUF (4096 bytes); events are ~200 bytes                                          |
| Parent/child session deduplication             | Session events keyed by `session_id`; subagent events keyed by `agent_id`. No double-counting                          |
| High-cardinality Prometheus labels             | `session` label uses first 8 chars of UUID. `agent_id` only on agent-specific metrics, not high-volume session metrics |
| Port 3001 conflict with backend dev            | Changed to port 3002 for Grafana                                                                                       |
| Disable switch                                 | Sentinel file `~/.claude/metrics/.disabled` checked at top of every script                                             |
| Hook error handling                            | All hooks use `set -euo pipefail`; stderr logged but never blocks Claude Code                                          |
| Pushgateway stale data accumulation            | Cleanup step in session-end.sh deletes previous session metrics                                                        |
| Failed push data loss                          | Replay mechanism saves failed payloads to `pending/` directory                                                         |
| Phase detection silent degradation             | Validation in session-end.sh warns if >90% events tagged "adhoc"                                                       |
| Hooks not version-controlled                   | Canonical copies in `scripts/ce-metrics/hooks/` with install script                                                    |
| No hook unit tests                             | Test harness with synthetic JSON inputs for isolated testing                                                           |

---

## Atomic Todo Breakdown (18 Tasks)

### Phase 1: Docker Stack (T01–T04)

| ID  | Task                                                                                                                            | Expert         | Depends On | Parallel?             |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | -------------- | ---------- | --------------------- |
| T01 | Create `monitoring/` dir scaffold + `prometheus.yml` + Grafana datasource/dashboard provider YAMLs                              | infra-engineer | None       | Start immediately     |
| T02 | Placeholder `ce-metrics-main.json` skeleton with 5 template variables                                                           | infra-engineer | T01        | After T01             |
| T03 | Add 3 services to `docker-compose.dev.yml` + volumes + `ce-monitoring` network + resource limits + health checks + `.gitignore` | infra-engineer | T01        | **Parallel with T02** |
| T04 | Verify stack starts clean — all health checks + datasource green + Grafana at `:3002`                                           | infra-engineer | T02, T03   | Gate task             |

### Phase 2: Hook Infrastructure (T05–T12)

| ID  | Task                                                                                                                                                                                                         | Expert         | Depends On    | Parallel?             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- | ------------- | --------------------- |
| T05 | `lib.sh` — shared functions (`get_phase` via jq, `emit_event` with project label, `parse_last_turn_tokens` via `tail -1 \| jq`, `emit_git_event` via `case`, fast-exit guard, disable check, JSONL rotation) | hook-developer | None          | Start immediately     |
| T06 | `session-start.sh` + `turn-complete.sh` + `agent-spawn.sh` — phase detection, per-turn tokens, agent tracking                                                                                                | hook-developer | T05           | After T05             |
| T07 | `agent-complete.sh` + `git-event.sh` + `task-complete.sh` — agent transcript parsing, git `case` match, task sanitization                                                                                    | hook-developer | T05           | **Parallel with T06** |
| T08 | `session-end.sh` — aggregate from `ce-events.jsonl` via `jq -s`, pushgateway push + curl timeouts, replay mechanism, stale cleanup, phase validation                                                         | hook-developer | T05           | **Parallel with T06** |
| T09 | Register all 7 hooks in `~/.claude/settings.json` + `install-hooks.sh` bootstrap + `test-hooks.sh` harness + `seed-test-data.sh`                                                                             | hook-developer | T06, T07, T08 | After all hooks       |
| T10 | Skill frontmatter hooks for plan/work/review/compound phase detection (`once: true`)                                                                                                                         | hook-developer | T05           | Fully independent     |
| T11 | Version hooks in `scripts/ce-metrics/hooks/` (canonical copies)                                                                                                                                              | hook-developer | T09           | After registration    |
| T12 | Regression test — existing hooks not broken + CE hooks fire + test harness passes                                                                                                                            | qa-validator   | T09, T10      | Gate task             |

### Phase 3: Grafana Dashboard + Wrap-up (T13–T18)

| ID  | Task                                                                                  | Expert             | Depends On    | Parallel?             |
| --- | ------------------------------------------------------------------------------------- | ------------------ | ------------- | --------------------- |
| T13 | Template variable wiring + Row 1 (4 KPI stats) + Row 2 (3 Cost panels)                | dashboard-designer | T02           | Foundation            |
| T14 | Row 3 (3 Velocity panels) + Row 4 (3 Quality panels)                                  | dashboard-designer | T13           | After T13             |
| T15 | Row 5 (3 Knowledge+Agent panels) + Row 6 (3 Active Session panels) + drill-down links | dashboard-designer | T13           | **Parallel with T14** |
| T16 | Verify all ~19 panels render + template variables cascade + seed data displays        | qa-validator       | T14, T15, T04 | Gate task             |
| T17 | DoD verification — all 5 dimensions at project+per-PR+trend levels + disable toggle   | qa-validator       | T16, T12      | Final gate            |
| T18 | `CE_METRICS_DASHBOARD.md` + update `PROJECT_CONTEXT.md` sections 3 and 5              | hook-developer     | T17           | Last task             |

### Dependency Graph

```
T01 ──► T02 ──────────────────────► T13 ──► T14 ─┐
 └──► T03 (parallel) ──► T04                      ├──► T16 ──► T17 ──► T18
                                    T13 ──► T15 ─┘         │
                                                            │
T05 ──► T06 ─┐                                              │
 ├──► T07 ───┼──► T09 ──► T11                               │
 ├──► T08 ───┘              │                               │
 └──► T10 ─────────────────► T12 ──────────────────────────┘
```

### Expert Role Allocation

| Role               | Todos                                  | Count |
| ------------------ | -------------------------------------- | ----- |
| infra-engineer     | T01, T02, T03, T04                     | 4     |
| hook-developer     | T05, T06, T07, T08, T09, T10, T11, T18 | 8     |
| dashboard-designer | T13, T14, T15                          | 3     |
| qa-validator       | T12, T16, T17                          | 3     |

### Maximum Parallelism Points

1. **Phase 1**: T02 ‖ T03 (2 parallel)
2. **Phase 2**: T06 ‖ T07 ‖ T08 (3 hooks after T05) + T10 independent
3. **Phase 3**: T14 ‖ T15 (2 row groups after T13)
