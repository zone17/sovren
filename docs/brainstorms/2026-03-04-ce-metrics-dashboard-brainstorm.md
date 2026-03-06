---
title: 'CE Metrics Dashboard — Live Engineering Intelligence'
date: 2026-03-04
type: brainstorm
status: decided
---

# CE Metrics Dashboard — Live Engineering Intelligence

## What We're Building

A live Grafana dashboard powered by OTEL + Prometheus that tracks all 5 dimensions of Compound Engineering effectiveness — **Cost Efficiency, Velocity, Quality, Knowledge Compound Rate, and Agent Efficiency** — with project-level totals, per-PR granularity, and trend analysis. Data collection is fully automated via Claude Code hooks embedded in existing CE workflows.

## Why This Approach

### Problem Statement

After 50+ sprints using the CE loop, we have zero visibility into:

- **Token/cost spend** per PR, per phase (plan/work/review/compound), per model tier
- **Time-to-merge** trends — is the CE loop getting faster or slower?
- **Quality trends** — are P1 rates declining sprint over sprint?
- **Compound effectiveness** — are documented patterns actually preventing re-investigation?
- **Agent efficiency** — what's the optimal team size, conflict rate, respawn rate?

Current metrics in compound docs (files changed, findings count, CI runs to green) are process-oriented. They tell you _what happened_ but not _how efficiently_ or _whether you're improving_.

### Why Grafana + OTEL + Prometheus

1. **Anthropic's official recommendation** — [claude-code-monitoring-guide](https://github.com/anthropics/claude-code-monitoring-guide) provides Docker configs
2. **Production-grade** — same stack used for backend monitoring (prom-client already deployed)
3. **Extensible** — OTEL spans carry arbitrary attributes; new metrics don't require schema changes
4. **Real-time** — Grafana auto-refreshes; no manual report generation
5. **Docker already in use** — backend dev uses docker-compose.dev.yml; sidecar overhead is negligible

### Why Hook-Based Data Collection

- **Zero manual input** — hooks fire automatically on workflow events
- **Precise timestamps** — captures phase transitions at millisecond granularity
- **Token data available** — Claude Code exposes session cost/token counts
- **Composable** — new hooks can be added without modifying existing workflows

### Why PR-Based Sprint Boundaries

- Matches compound doc cadence (one doc per PR)
- Auto-detected from git history (no manual tagging)
- Natural unit of work in the CE loop
- Enables drill-down: project → PR → phase → agent

## Key Decisions

### Decision 1: Dashboard Platform → Grafana

**Rationale:** Already have Prometheus infrastructure (deployment-monitoring.ts, prom-client). Grafana is the natural visualization layer. Anthropic provides pre-built configs.

### Decision 2: Data Collection → PostToolUse Hooks

**Rationale:** Claude Code hooks fire on tool calls. Structured events emitted as OTEL spans to the collector. No manual input, no workflow modification needed.

### Decision 3: MVP Scope → All 5 Dimensions

**Rationale:** The 5 dimensions are interdependent (cost without velocity is meaningless). Building all at once ensures the data model is comprehensive from day one.

### Decision 4: Sprint Unit → PR-Based

**Rationale:** Each merged PR = one sprint/compound doc. Natural boundary, auto-detected, enables drill-down.

## The 5 Dimensions — Metrics Specification

### Dimension 1: Cost Efficiency (Token ROI)

| Metric                                        | Source                      | Grafana Panel Type |
| --------------------------------------------- | --------------------------- | ------------------ |
| Total token spend (input + output + cache)    | Claude Code session data    | Stat + time series |
| Cost per PR                                   | tokens / PR count           | Stat + bar chart   |
| Cost per CE phase (plan/work/review/compound) | Hook phase tags             | Stacked bar        |
| Cache hit ratio                               | cache_read / cache_creation | Gauge              |
| Cost by model tier (opus/sonnet/haiku)        | Session model field         | Pie chart          |
| Orphaned sessions (no commit)                 | Sessions without git commit | Counter            |
| Line survival rate (30-day)                   | Git blame analysis          | Time series        |

### Dimension 2: Velocity (Speed to Delivery)

| Metric                                 | Source                                    | Grafana Panel Type |
| -------------------------------------- | ----------------------------------------- | ------------------ |
| Wall-clock time: plan to merge         | Hook timestamps                           | Stat + time series |
| Time per CE phase                      | Phase start/end hooks                     | Stacked bar        |
| PRs merged per day                     | Git/GitHub API                            | Time series        |
| Review round count                     | /workflows:review invocation count per PR | Bar chart          |
| CI recovery time (first fail to green) | GitHub Actions API                        | Time series        |
| Agent task completion time             | TaskUpdate hooks                          | Histogram          |

### Dimension 3: Quality (Defect Prevention)

| Metric                          | Source                                      | Grafana Panel Type |
| ------------------------------- | ------------------------------------------- | ------------------ |
| Finding rate per 1K lines       | Findings / (lines changed / 1000)           | Time series        |
| Findings by severity (P1/P2/P3) | Todo files or review output                 | Stacked bar        |
| P1 rate trend                   | P1 count per PR over time                   | Time series        |
| Defect escape rate              | Post-merge bugs (manual tag or issue label) | Gauge              |
| Rework rate                     | Lines re-changed within 14 days             | Time series        |
| Test coverage delta per PR      | Coverage diff from CI                       | Bar chart          |

### Dimension 4: Knowledge Compound Rate

| Metric                         | Source                                               | Grafana Panel Type |
| ------------------------------ | ---------------------------------------------------- | ------------------ |
| Pattern reuse rate             | Grep pattern refs in briefs/fixes                    | Time series        |
| Stale todo rate                | Triaged-as-stale / total findings                    | Gauge              |
| Repeat finding rate            | Same pattern # flagged across PRs                    | Counter            |
| Time-to-fix for known patterns | Fix time when pattern doc exists vs first occurrence | Comparison bar     |
| Compound docs created          | Count in docs/solutions/                             | Counter            |
| Pattern file growth            | Pattern count in common-solutions.md                 | Time series        |

### Dimension 5: Agent Efficiency

| Metric                                 | Source                                   | Grafana Panel Type     |
| -------------------------------------- | ---------------------------------------- | ---------------------- |
| Merge conflict rate                    | Git merge conflict events                | Gauge (streak counter) |
| Optimal team size                      | Agents per PR vs finding resolution rate | Scatter plot           |
| Agent respawn rate                     | Respawn events / total agent spawns      | Gauge                  |
| Brief revision rate                    | Clarification messages / total briefs    | Bar chart              |
| Agent task completion time             | TaskUpdate in_progress → completed       | Histogram              |
| Domain-grouped vs cross-domain success | Conflict rate by grouping strategy       | Comparison bar         |

## Architecture Overview

```
Claude Code Session
    │
    ├── PostToolUse Hook ──→ OTEL Exporter ──→ OTEL Collector
    │   (emits spans with                      │
    │    phase, model, tokens,                  │
    │    agent, task metadata)                  ├──→ Prometheus
    │                                           │    (metrics storage)
    ├── Session End Hook ──→ OTEL Exporter ─────┘
    │   (final cost, duration,                       │
    │    commit SHA, PR number)                      │
    │                                                ▼
    └── Post-Merge Hook ──→ Git Analyzer ──→    Grafana
        (findings count, patterns,              (5-dimension dashboard)
         compound doc metadata)
```

### Hook Events — Detailed Schema

Based on Claude Code's hook system (verified against official docs), here are the exact hooks, their input fields, and what our handler extracts:

#### 1. `SessionStart` — CE Phase Detection

**Fires**: When a session begins or resumes.
**Input fields**: `session_id`, `transcript_path`, `cwd`, `permission_mode`
**Our handler does**: Write phase state file. The handler inspects the session context (via a lightweight check of the last user message in the transcript) to detect which CE phase is active.

```json
// Phase state file: ~/.claude/metrics/ce-phase.json
{
  "session_id": "fd3e13e6-...",
  "phase": "review",
  "branch": "feat/squad-a/S2-business-manager-mvp",
  "started_at": "2026-03-04T15:44:54Z"
}
```

**Phase detection heuristic**: Parse the last user message for `/workflows:plan`, `/workflows:work`, `/workflows:review`, `/workflows:compound` invocations. If none found, phase = "adhoc".

#### 2. `Stop` — Per-Turn Token Accumulator

**Fires**: Every time Claude finishes responding.
**Input fields**: `session_id`, `transcript_path`, `stop_hook_active`, `last_assistant_message`
**Our handler does**: Parse the last assistant turn from `transcript_path` for token counts. Append to cumulative event log. **Must be async** to avoid blocking the agentic loop.

```json
// Appended to ~/.claude/metrics/ce-events.jsonl
{
  "event": "turn_complete",
  "timestamp": "2026-03-04T16:02:33Z",
  "session_id": "fd3e13e6-...",
  "phase": "review",
  "model": "claude-opus-4-6",
  "input_tokens": 2,
  "output_tokens": 847,
  "cache_read_tokens": 52306,
  "cache_creation_tokens": 0,
  "estimated_cost_usd": 0.14,
  "turn_number": 42
}
```

**Critical**: Use `"async": true` to run in background. Stop hooks that block cause UX lag.

#### 3. `SubagentStart` — Agent Spawn Tracking

**Fires**: When a subagent is spawned (Agent tool call).
**Input fields**: `session_id`, `transcript_path`, `agent_id`, `agent_type`
**Our handler does**: Record agent spawn event with phase context.

```json
{
  "event": "agent_spawn",
  "timestamp": "2026-03-04T16:10:00Z",
  "session_id": "fd3e13e6-...",
  "phase": "review",
  "agent_id": "agent-abc123",
  "agent_type": "compound-engineering:review:kieran-rails-reviewer"
}
```

#### 4. `SubagentStop` — Agent Completion with Token Data

**Fires**: When a subagent finishes.
**Input fields**: `session_id`, `transcript_path`, `agent_id`, `agent_type`, `agent_transcript_path`, `last_assistant_message`
**Our handler does**: Parse `agent_transcript_path` JSONL for agent-specific token totals. Compute duration from first to last turn timestamp.

```json
{
  "event": "agent_complete",
  "timestamp": "2026-03-04T16:12:30Z",
  "session_id": "fd3e13e6-...",
  "phase": "review",
  "agent_id": "agent-abc123",
  "agent_type": "compound-engineering:review:kieran-rails-reviewer",
  "agent_transcript_path": "~/.claude/.../subagents/agent-abc123.jsonl",
  "duration_ms": 150000,
  "agent_turns": 12,
  "agent_input_tokens": 1200,
  "agent_output_tokens": 5600,
  "agent_model": "claude-opus-4-6"
}
```

#### 5. `TaskCompleted` — Task Resolution Tracking

**Fires**: When a task is marked as completed.
**Input fields**: `session_id`, `task_id`, `task_subject`, `task_description`, `teammate_name`, `team_name`
**Our handler does**: Record task completion for velocity tracking.

```json
{
  "event": "task_complete",
  "timestamp": "2026-03-04T16:15:00Z",
  "session_id": "fd3e13e6-...",
  "phase": "review",
  "task_id": "task-001",
  "task_subject": "Fix P1 export URL bypass",
  "teammate_name": "backend-reviewer",
  "team_name": "review-squad"
}
```

#### 6. `PostToolUse` (matcher: `Bash`) — Git Event Detection

**Fires**: After every successful Bash command.
**Input fields**: `session_id`, `tool_input.command`, `tool_result`
**Our handler does**: Pattern-match the command for git operations. Only emit events for commits, pushes, and PR merges. **Must be async** (high frequency).

```json
// Emitted only when command matches git commit|push|gh pr merge
{
  "event": "git_commit",
  "timestamp": "2026-03-04T16:20:00Z",
  "session_id": "fd3e13e6-...",
  "phase": "review",
  "command": "git commit -m ...",
  "sha": "5ae6637"
}
```

**Pattern matchers**:

- `git commit` → `git_commit` event
- `git push` → `git_push` event
- `gh pr merge` → `pr_merge` event (extract PR number)
- `gh pr create` → `pr_create` event

#### 7. `SessionEnd` — Session Summary Aggregation

**Fires**: When session terminates.
**Input fields**: `session_id`, `transcript_path`, `reason`
**Our handler does**: Aggregate all turns in `transcript_path` into session summary. Push final summary to Prometheus pushgateway.

```json
{
  "event": "session_end",
  "timestamp": "2026-03-04T17:56:00Z",
  "session_id": "fd3e13e6-...",
  "phase": "review",
  "reason": "other",
  "total_turns": 654,
  "total_input_tokens": 17285,
  "total_output_tokens": 123600,
  "total_cache_read": 75376315,
  "total_cache_creation": 2960194,
  "total_estimated_cost_usd": 177.86,
  "duration_minutes": 131,
  "model": "claude-opus-4-6",
  "agents_spawned": 8,
  "tasks_completed": 12,
  "git_commits": 3,
  "git_pushes": 3
}
```

### CE Phase State Management

Hooks need to know which CE phase is active. Since hooks are stateless shell commands, we use a **phase state file**:

```
~/.claude/metrics/ce-phase.json
```

**Who writes it**: The CE workflow skills (plan/work/review/compound) write this file at phase start via a `SessionStart` or `UserPromptSubmit` hook that detects `/workflows:*` invocations.

**Who reads it**: Every other hook reads this file to tag events with the current phase.

**Fallback**: If no phase file exists, tag as `phase: "adhoc"`.

### Data Pipeline

```
Hooks (shell scripts)
    │
    ├── Write events → ~/.claude/metrics/ce-events.jsonl
    │                   (append-only, one JSON per line)
    │
    └── SessionEnd hook pushes session summary →
                                                   Prometheus Pushgateway
                                                   (localhost:9091)
                                                        │
                                                        ▼
                                                   Prometheus
                                                   (scrapes pushgateway every 15s)
                                                        │
                                                        ▼
                                                   Grafana
                                                   (queries Prometheus)
```

**Alternative for real-time**: OTEL Collector's `filelog` receiver can tail `ce-events.jsonl` and export to Prometheus in real-time, giving sub-minute dashboard updates without waiting for SessionEnd.

### Docker Services (added to docker-compose.dev.yml)

```yaml
services:
  otel-collector:
    image: otel/opentelemetry-collector-contrib:latest
    ports: ['4317:4317', '4318:4318']

  prometheus:
    image: prom/prometheus:latest
    ports: ['9090:9090']
    volumes: ['./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml']

  grafana:
    image: grafana/grafana:latest
    ports: ['3001:3000']
    volumes: ['./monitoring/grafana/:/etc/grafana/provisioning/']
```

## Grafana Dashboard UX — RESOLVED

### Design Principles (from [Grafana best practices](https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/best-practices/))

1. **Tell a story** — dashboard flows top-to-bottom: overview → dimension deep-dives → agent detail
2. **Cognitive load first** — stat panels for instant answers, time series for trends, tables for investigation
3. **Color = meaning** — blue (healthy), yellow (warning), red (critical). No decorative color
4. **Template variables for drill-down** — one dashboard serves all contexts (project-wide, per-PR, per-phase)
5. **Stacking caution** — avoid stacked graphs unless the "total" is meaningful. Use side-by-side bars instead

### Template Variables (Top Bar)

Variables cascade: selecting a PR filters phases, agents, and tasks downstream.

| Variable     | Type     | Source                            | Default  | Purpose                        |
| ------------ | -------- | --------------------------------- | -------- | ------------------------------ |
| `$project`   | Custom   | Hardcoded project list            | `Sovren` | Multi-project support (future) |
| `$pr`        | Query    | Prometheus label `pr_number`      | `All`    | Filter to specific PR          |
| `$phase`     | Custom   | `plan,work,review,compound,adhoc` | `All`    | Filter by CE phase             |
| `$model`     | Query    | Prometheus label `model`          | `All`    | Filter by model tier           |
| `$timeRange` | Interval | `5m,15m,1h,6h,12h,1d,7d,30d,90d`  | `30d`    | Default time window            |

**Drill-down flow**: Click PR number in any table/bar chart → `$pr` variable updates → all panels re-filter to that PR's data. Same for phase and model.

### Prometheus Metric Names

Based on [Claude Code's OTEL metrics](https://gist.github.com/mikelane/9bf3053b5608df5858d299d636a48e8f) + our CE additions:

**Built-in (from Claude Code OTEL)**:

```
claude_code_token_usage_tokens_total{type, model}     # type: input|output|cacheRead|cacheCreation
claude_code_cost_usage_USD_total{model}                # Cumulative cost by model
claude_code_active_time_seconds_total{type}            # type: cli|user
claude_code_lines_of_code_count_total{type}            # type: added|removed
claude_code_session_count_total                         # Session counter
claude_code_commit_count_total                          # Commit counter
```

**CE-specific (from our hooks)**:

```
ce_pr_merged_total{pr_number, branch}                   # PR merge events
ce_phase_duration_seconds{phase, pr_number}             # Time per CE phase
ce_findings_total{severity, pr_number}                  # P1/P2/P3 counts
ce_agent_spawn_total{agent_type, phase}                 # Agent spawns
ce_agent_duration_seconds{agent_type, agent_id}         # Per-agent duration
ce_agent_tokens_total{agent_type, token_type}           # Per-agent token spend
ce_task_completed_total{team_name}                      # Task completions
ce_pattern_reuse_total{pattern_id}                      # Pattern reference count
ce_stale_todo_total{pr_number}                          # Stale todo count per PR
ce_review_rounds_total{pr_number}                       # Review rounds per PR
ce_merge_conflict_total{team_name}                      # Merge conflicts
ce_agent_respawn_total{agent_type}                      # Agent respawns
```

### Dashboard Layout — Detailed Panel Specification

**Dashboard Title**: `CE Engineering Intelligence`
**UID**: `ce-metrics-main`
**Refresh**: `30s`
**Default range**: `Last 30 days`

---

#### Row 0: Executive Summary (collapsed by default for returning users)

A single text panel with markdown explaining the 5 dimensions and how to use the dashboard. First-time users expand this; regulars skip.

---

#### Row 1: Project-Level KPIs (6 Stat Panels)

Immediate answers to "how are we doing?" — one glance, no clicking.

| Panel                 | Type             | Query                                                                                                                       | Thresholds                            | Width |
| --------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ----- |
| **Total Cost**        | Stat             | `sum(ce_session_cost_usd)`                                                                                                  | blue <$500, yellow <$1000, red >$1000 | 4     |
| **Cost Trend**        | Stat + sparkline | `sum(rate(claude_code_cost_usage_USD_total[$timeRange]))`                                                                   | Green = decreasing, red = increasing  | 4     |
| **PRs Merged**        | Stat             | `sum(ce_pr_merged_total)`                                                                                                   | —                                     | 4     |
| **Avg Time-to-Merge** | Stat             | `avg(ce_phase_duration_seconds{phase=~".*"}) by (pr_number)`                                                                | blue <4h, yellow <8h, red >8h         | 4     |
| **P1 Trend**          | Stat + sparkline | `sum(ce_findings_total{severity="p1"})`                                                                                     | Green = 0, yellow = 1-2, red >2       | 4     |
| **Cache Efficiency**  | Gauge            | `sum(claude_code_token_usage_tokens_total{type="cacheRead"}) / (sum(...{type="cacheRead"}) + sum(...{type="input"})) * 100` | red <50%, yellow <80%, green >80%     | 4     |

**Height**: 3 grid units (compact)

---

#### Row 2: Cost Efficiency (4 Panels)

Answers "where is money going?" and "is spend improving?"

| Panel                 | Type                   | Query                                                   | Notes                                                                               | Width |
| --------------------- | ---------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----- |
| **Cost per PR**       | Bar chart              | `sum by (pr_number) (ce_session_cost_usd)`              | X-axis = PR number, sorted descending. Click bar → drill to PR                      | 8     |
| **Cost by CE Phase**  | Pie chart              | `sum by (phase) (ce_session_cost_usd{phase=~"$phase"})` | Slices: plan (blue), work (green), review (orange), compound (purple), adhoc (gray) | 4     |
| **Cost by Model**     | Pie chart              | `sum by (model) (claude_code_cost_usage_USD_total)`     | Slices: opus (gold), sonnet (silver), haiku (bronze)                                | 4     |
| **Token Composition** | Bar gauge (horizontal) | `sum by (type) (claude_code_token_usage_tokens_total)`  | Shows input, output, cache_read, cache_creation as bars with labels                 | 8     |

---

#### Row 3: Velocity (4 Panels)

Answers "are we getting faster?" and "where does time go?"

| Panel                        | Type                            | Query                                                               | Notes                                                                 | Width |
| ---------------------------- | ------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------- | ----- |
| **Time-to-Merge Trend**      | Time series                     | `ce_phase_duration_seconds{phase="total"} by (pr_number)` over time | Line chart with trendline. Each dot = one PR                          | 8     |
| **Phase Duration Breakdown** | Bar chart (horizontal, stacked) | `sum by (phase) (ce_phase_duration_seconds) / 3600`                 | Per-PR horizontal bars, stacked by phase. Shows which phase dominates | 8     |
| **PRs Merged per Day**       | Time series                     | `sum(increase(ce_pr_merged_total[1d]))`                             | Daily bar overlay on cumulative line                                  | 4     |
| **Review Rounds per PR**     | Bar chart                       | `ce_review_rounds_total by (pr_number)`                             | Target: 1-2 rounds. >3 = red. Shows review rework                     | 4     |

**Stacking note**: Phase Duration uses stacking because the total (sum of phases) IS meaningful — it's the total PR lifecycle time. This is the exception to the "avoid stacking" guideline.

---

#### Row 4: Quality (4 Panels)

Answers "is code quality improving?" and "are patterns working?"

| Panel                                | Type                | Query                                                                                                                        | Notes                                                                | Width |
| ------------------------------------ | ------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----- |
| **Finding Rate per 1K LOC**          | Time series         | `(sum(ce_findings_total) by (pr_number)) / (sum(claude_code_lines_of_code_count_total{type="added"}) by (pr_number) / 1000)` | Trend line — lower is better. Each point = one PR                    | 8     |
| **Findings by Severity**             | Bar chart (stacked) | `sum by (severity) (ce_findings_total{pr_number="$pr"})`                                                                     | P1 red, P2 yellow, P3 blue. Stacked OK here — total findings matters | 4     |
| **P1 Rate Over Time**                | Time series         | `sum(ce_findings_total{severity="p1"}) by (pr_number)` over time                                                             | The most important quality signal — should trend toward 0            | 4     |
| **Severity Distribution (All Time)** | Pie chart           | `sum by (severity) (ce_findings_total)`                                                                                      | Project-wide severity split                                          | 4     |

---

#### Row 5: Knowledge Compound Rate (4 Panels)

Answers "is documented knowledge being reused?" and "are we re-investigating solved problems?"

| Panel                     | Type             | Query                                                              | Notes                                                                                  | Width |
| ------------------------- | ---------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ----- |
| **Stale Todo Rate**       | Gauge            | `sum(ce_stale_todo_total) / sum(ce_findings_total) * 100`          | Higher = more findings are already fixed. Target: >60% (validated at 71-76% from data) | 6     |
| **Pattern File Growth**   | Time series      | Custom metric from git log counting lines in `common-solutions.md` | Shows compound knowledge accumulation over time                                        | 6     |
| **Repeat Finding Rate**   | Bar chart        | `topk(10, sum by (pattern_id) (ce_pattern_reuse_total))`           | Top 10 most-referenced patterns. High reuse = compound working                         | 6     |
| **Compound Docs Created** | Stat + sparkline | `count` of files in `docs/solutions/` over time                    | Monotonically increasing — shows documentation discipline                              | 6     |

---

#### Row 6: Agent Efficiency (4 Panels)

Answers "are agent teams well-sized?" and "what causes agent failures?"

| Panel                          | Type               | Query                                                           | Notes                                                                   | Width |
| ------------------------------ | ------------------ | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ----- |
| **Merge Conflict Streak**      | Stat               | `ce_consecutive_zero_conflict_sprints`                          | Current streak of zero-conflict sprints. Green >5, yellow 2-4, red 0-1  | 4     |
| **Team Size vs Effectiveness** | XY chart (scatter) | X: agent count per PR, Y: findings resolved per PR              | Scatter plot to find optimal team size. Expect sweet spot at 4-6 agents | 8     |
| **Agent Respawn Rate**         | Gauge              | `sum(ce_agent_respawn_total) / sum(ce_agent_spawn_total) * 100` | Lower is better. Target: <10%. High = poor briefs or context issues     | 4     |
| **Task Completion Time**       | Histogram          | `ce_agent_duration_seconds` bucketed                            | Distribution of how long agents take. Identify outliers                 | 8     |

---

#### Row 7: Active Session (live — visible only during active sessions)

Real-time visibility into the current coding session.

| Panel                    | Type             | Query                                 | Notes                                    | Width |
| ------------------------ | ---------------- | ------------------------------------- | ---------------------------------------- | ----- |
| **Current Session Cost** | Stat             | `ce_current_session_cost_usd`         | Live-updating from Stop hook             | 4     |
| **Current Phase**        | Stat (text mode) | `ce_current_phase`                    | Shows "review", "plan", etc. Color-coded | 4     |
| **Tokens This Session**  | Bar gauge        | `ce_current_session_tokens by (type)` | Live token accumulation                  | 8     |
| **Agents Active**        | Stat             | `ce_active_agents`                    | Count of running agents right now        | 4     |
| **Session Duration**     | Stat             | `time() - ce_session_start_time`      | Clock counting up                        | 4     |

---

### Drill-Down Interaction Design

**1. PR Drill-Down** (primary interaction):

- Click any PR number in a bar chart or table → `$pr` variable updates
- ALL panels re-filter to show only that PR's data
- A "Back to All" link appears next to the variable dropdown
- URL updates to `?var-pr=136` for shareability

**2. Phase Drill-Down**:

- Click a phase slice in the Cost by Phase pie chart → `$phase` variable updates
- See all metrics filtered to just "review" phase, for example
- Answers: "How much does our review phase cost? How long does it take?"

**3. Table-to-Detail**:

- Bottom of dashboard: a **Table panel** listing all PRs with columns:
  ```
  PR# | Branch | Date | Cost | Duration | Findings (P1/P2/P3) | Review Rounds | Agents | Status
  ```
- Each PR# is a data link → sets `$pr` variable on click
- Sort by any column. Default: most recent first
- This table is the "index" for exploration

**4. Cross-Dashboard Links**:

- Each agent in the Agent Efficiency row links to a detail sub-dashboard showing per-agent token breakdown, transcript excerpts, and task list
- Future: link to GitHub PR page via `https://github.com/owner/repo/pull/$pr`

### Color Palette

| Element        | Color  | Hex       | Meaning                           |
| -------------- | ------ | --------- | --------------------------------- |
| Healthy/Good   | Blue   | `#1F77B4` | Normal, within threshold          |
| Warning        | Yellow | `#FFA500` | Approaching limit                 |
| Critical       | Red    | `#D62728` | Exceeded threshold, action needed |
| Plan phase     | Blue   | `#4C78A8` | Research/planning                 |
| Work phase     | Green  | `#54A24B` | Implementation                    |
| Review phase   | Orange | `#F58518` | Review/remediation                |
| Compound phase | Purple | `#B279A2` | Documentation                     |
| Adhoc          | Gray   | `#9D9D9D` | Untagged work                     |
| Opus model     | Gold   | `#E5A100` | Most expensive model              |
| Sonnet model   | Silver | `#B0B0B0` | Mid-tier model                    |
| Haiku model    | Bronze | `#CD7F32` | Cheapest model                    |

### Dashboard JSON Provisioning

Dashboards will be provisioned via files (not manual UI creation):

```
monitoring/
├── grafana/
│   ├── provisioning/
│   │   ├── dashboards/
│   │   │   └── dashboards.yml          # Provider config (path: /var/lib/grafana/dashboards)
│   │   └── datasources/
│   │       └── datasources.yml          # Prometheus datasource (http://prometheus:9090)
│   └── dashboards/
│       ├── ce-metrics-main.json         # Primary 5-dimension dashboard
│       ├── ce-agent-detail.json         # Agent drill-down sub-dashboard
│       └── ce-session-live.json         # Real-time session dashboard (optional split)
├── prometheus.yml                        # Scrape config (pushgateway + OTEL collector)
└── otel-collector-config.yml            # Filelog receiver for ce-events.jsonl
```

**Provisioning loader** (`dashboards.yml`):

```yaml
apiVersion: 1
providers:
  - name: 'CE Metrics'
    orgId: 1
    folder: 'CE Engineering Intelligence'
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /var/lib/grafana/dashboards
      foldersFromFilesStructure: false
```

**Key design choices**:

- `allowUiUpdates: true` — iterate in UI, export JSON back to repo
- `updateIntervalSeconds: 10` — file changes hot-reload without restart
- Dashboard JSON is version-controlled in the Sovren repo
- Grafana runs at `localhost:3001` (avoids conflict with Vite dev server on 3000)

### Reference Implementation

The [mikelane/claude-code-metrics](https://gist.github.com/mikelane/9bf3053b5608df5858d299d636a48e8f) gist provides a working starting point with 3 dashboards (metrics, summary, economics). Our implementation extends this with:

- CE phase tracking (plan/work/review/compound)
- Agent efficiency metrics (spawns, respawns, per-agent tokens)
- Quality/findings tracking (P1/P2/P3 per PR)
- Knowledge compound rate (stale todo %, pattern reuse, pattern growth)
- Template variables for PR-level drill-down

## Alerts & Thresholds — RESOLVED

### Alert Philosophy

These are **personal engineering intelligence alerts**, not production incident alerts. Key differences from [Grafana's production alerting best practices](https://grafana.com/docs/grafana/latest/alerting/guides/best-practices/):

1. **No paging** — nobody gets woken up. Notifications are advisory.
2. **Symptom-based** — alert on outcomes (cost spike, quality drop), not internals (token count increase).
3. **Noise reduction first** — use `avg_over_time()` smoothing and pending periods. A false alert in a personal dashboard erodes trust fast.
4. **Actionable** — every alert annotation includes: what triggered, why it matters, and what to do.
5. **Mutable** — mute timings for exploration/brainstorm sessions where cost spikes are expected.

### Severity Levels

| Level        | Label               | Meaning                                 | Notification                                    | Action                             |
| ------------ | ------------------- | --------------------------------------- | ----------------------------------------------- | ---------------------------------- |
| **Info**     | `severity=info`     | Awareness — interesting trend           | Dashboard annotation only                       | Review at session end              |
| **Warning**  | `severity=warning`  | Investigate — approaching limit         | Desktop notification (optional webhook)         | Investigate within current session |
| **Critical** | `severity=critical` | Stop and fix — budget or quality breach | Desktop notification + Slack webhook (optional) | Address before next PR             |

### Alert Rules by Dimension

#### Dimension 1: Cost Efficiency Alerts

| Alert Name                | Condition                                                          | Pending                      | Severity | Annotation                                                                                                           |
| ------------------------- | ------------------------------------------------------------------ | ---------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------- |
| **Cost Spike**            | `ce_session_cost_usd > 2 * avg_over_time(ce_session_cost_usd[7d])` | 0m (per-session)             | Warning  | "This session costs 2x your 7-day average. Check for runaway agent loops or excessive context."                      |
| **Budget Breach**         | `sum(ce_session_cost_usd{range="30d"}) > $monthly_budget`          | 0m                           | Critical | "Monthly cost exceeded ${{monthly_budget}}. Consider using Sonnet/Haiku for routine tasks."                          |
| **Cache Efficiency Drop** | `cache_hit_ratio < 50%` sustained for 3 sessions                   | 0m (checked per session-end) | Warning  | "Cache efficiency below 50%. Context window may be thrashing. Check for excessive file reads or large tool results." |
| **Orphaned Session**      | Session ended with 0 commits and cost > $10                        | 0m                           | Info     | "Session cost $X with no commits. Expected for research/brainstorm, investigate for work/review phases."             |

```yaml
# monitoring/grafana/provisioning/alerting/cost-alerts.yml
apiVersion: 1
groups:
  - orgId: 1
    name: ce_cost_alerts
    folder: CE Engineering Intelligence
    interval: 60s
    rules:
      - uid: ce-cost-spike
        title: 'CE: Session Cost Spike (>2x average)'
        condition: B
        data:
          - refId: A
            datasourceUid: prometheus
            model:
              expr: ce_session_cost_usd
              refId: A
          - refId: B
            datasourceUid: '__expr__'
            model:
              type: threshold
              expression: A
              conditions:
                - evaluator:
                    type: gt
                    params: [0] # Dynamic: 2x avg computed in expression
        for: 0s
        labels:
          severity: warning
          dimension: cost
        annotations:
          summary: 'Session cost is 2x above 7-day average'
          runbook: 'Check for runaway agent loops. Consider model downgrade for routine tasks.'
```

#### Dimension 2: Velocity Alerts

| Alert Name        | Condition                                                                           | Pending | Severity | Annotation                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------- | ------- | -------- | ----------------------------------------------------------------------------------------------------- |
| **Slow PR**       | `ce_phase_duration_seconds{phase="total"} > 2 * avg_over_time(ce_pr_duration[30d])` | 0m      | Warning  | "This PR is taking 2x longer than your 30-day average. Check for scope creep or blocked reviews."     |
| **Review Loop**   | `ce_review_rounds_total{pr_number="$current"} > 3`                                  | 0m      | Warning  | "4+ review rounds on this PR. Consider splitting into smaller PRs or addressing root cause patterns." |
| **Velocity Drop** | `rate(ce_pr_merged_total[7d]) < 0.5 * rate(ce_pr_merged_total[30d])`                | 24h     | Info     | "PR merge rate dropped 50% this week vs monthly average. Normal during exploration/planning phases."  |

#### Dimension 3: Quality Alerts

| Alert Name                | Condition                                                                              | Pending                            | Severity | Annotation                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| **P1 Detected**           | `increase(ce_findings_total{severity="p1"}[1h]) > 0`                                   | 0m                                 | Critical | "P1 finding detected. Must be resolved before merge. Check todos/ for details."                    |
| **P1 Rate Rising**        | `avg_over_time(ce_p1_per_pr[5-PR window]) > avg_over_time(ce_p1_per_pr[20-PR window])` | 0m (checked per review completion) | Warning  | "P1 rate is increasing over recent PRs. Review compound docs for missed patterns."                 |
| **Finding Density Spike** | `ce_findings_per_1k_loc > 2 * avg_over_time(ce_findings_per_1k_loc[30d])`              | 0m                                 | Info     | "Finding density 2x above average. May indicate unfamiliar domain or insufficient planning phase." |

#### Dimension 4: Knowledge Compound Rate Alerts

| Alert Name               | Condition                                                                                | Pending | Severity | Annotation                                                                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------------- | ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Repeat Finding**       | Same `pattern_id` flagged in 3+ consecutive PRs                                          | 0m      | Warning  | "Pattern #{{pattern_id}} flagged again. The compound doc may need stronger prevention guidance or the pattern file entry is unclear." |
| **Stale Todo Rate Drop** | `ce_stale_todo_rate < 40%` (below historical 71-76% baseline)                            | 0m      | Info     | "Stale todo rate dropped below 40%. More findings are genuinely new — may indicate entering a new domain."                            |
| **Compound Doc Missing** | PR merged without corresponding file in `docs/solutions/` (when session had >3 findings) | 0m      | Warning  | "PR merged with findings but no compound doc created. Run /workflows:compound to capture learnings."                                  |

#### Dimension 5: Agent Efficiency Alerts

| Alert Name            | Condition                                       | Pending | Severity | Annotation                                                                                                                          |
| --------------------- | ----------------------------------------------- | ------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Agent Respawn**     | `ce_agent_respawn_total > 0` in current session | 0m      | Info     | "Agent respawned. Check brief clarity — vague briefs cause 80% of respawns."                                                        |
| **High Respawn Rate** | `ce_agent_respawn_rate > 20%` over 5-PR window  | 0m      | Warning  | "Respawn rate above 20%. Brief engineering quality may be degrading. Review recent briefs for clarity."                             |
| **Merge Conflict**    | `increase(ce_merge_conflict_total[1h]) > 0`     | 0m      | Warning  | "Merge conflict detected. Domain-grouped agents should have 0 conflicts (8-sprint streak validated). Check agent scope boundaries." |
| **Agent Timeout**     | `ce_agent_duration_seconds > 600` (10 min)      | 5m      | Warning  | "Agent running >10 minutes. May be stuck in a loop. Check for infinite retry patterns or large file reads."                         |

### Notification Contact Points

```yaml
# monitoring/grafana/provisioning/alerting/contact-points.yml
apiVersion: 1
contactPoints:
  - orgId: 1
    name: ce-desktop
    receivers:
      - uid: ce-desktop-webhook
        type: webhook
        settings:
          url: http://localhost:9876/ce-alert # Local notification daemon
          httpMethod: POST
          maxAlerts: '5'

  - orgId: 1
    name: ce-slack # Optional — for team visibility
    receivers:
      - uid: ce-slack-alerts
        type: slack
        settings:
          recipient: '#ce-metrics'
          token: ${SLACK_BOT_TOKEN}
          username: CE Metrics Bot
          title: '{{ .CommonLabels.alertname }}'
          text: '{{ .CommonAnnotations.summary }}'
```

### Notification Policies

```yaml
# monitoring/grafana/provisioning/alerting/notification-policies.yml
apiVersion: 1
policies:
  - orgId: 1
    receiver: ce-desktop
    group_by: [dimension, severity]
    group_wait: 30s # Wait 30s to batch related alerts
    group_interval: 5m # Don't re-notify within 5 min
    repeat_interval: 4h # Repeat unresolved critical alerts every 4h
    routes:
      # Critical alerts also go to Slack
      - receiver: ce-slack
        matchers:
          - label: severity
            value: critical
            type: '='
        continue: true # Also send to parent (desktop)

      # Info alerts are dashboard-only (no notification)
      - receiver: grafana-default-email # /dev/null equivalent
        matchers:
          - label: severity
            value: info
            type: '='
        group_wait: 0s
        repeat_interval: 0s
```

### Mute Timings

Suppress cost alerts during expected high-cost activities:

```yaml
# monitoring/grafana/provisioning/alerting/mute-timings.yml
apiVersion: 1
muteTimes:
  - orgId: 1
    name: brainstorm-sessions
    time_intervals:
      -  # No fixed schedule — manually activated via API call:
        # curl -X POST localhost:3001/api/v1/provisioning/mute-timings/brainstorm-sessions/activate
        # This mutes cost alerts during brainstorm/exploration where high spend is expected
```

**Manual mute for exploration sessions**:

```bash
# Start a brainstorm — mute cost alerts
alias ce-explore-start='curl -s -X POST http://localhost:3001/api/alerting/grafana/config/api/v1/silences -H "Content-Type: application/json" -d "{\"matchers\":[{\"name\":\"dimension\",\"value\":\"cost\",\"isRegex\":false}],\"startsAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"endsAt\":\"$(date -u -v+4H +%Y-%m-%dT%H:%M:%SZ)\",\"createdBy\":\"ce-cli\",\"comment\":\"Exploration session\"}"'

# End exploration — cost alerts resume automatically after 4h, or manually:
alias ce-explore-end='curl -s -X DELETE http://localhost:3001/api/alerting/grafana/config/api/v1/silence/$(curl -s http://localhost:3001/api/alerting/grafana/config/api/v1/silences | python3 -c "import json,sys; [print(s[\"id\"]) for s in json.load(sys.stdin) if s.get(\"comment\")==\"Exploration session\" and s[\"status\"][\"state\"]==\"active\"]")'
```

### Threshold Calibration Strategy

Thresholds are **not hardcoded** — they're derived from your historical data:

1. **Backfill first** — run the historical backfill script before configuring alerts. This populates Prometheus with 19 days of baseline data.
2. **Percentile-based thresholds** — set warning at p90, critical at p99 of historical distribution:
   - Cost per session: warning at p90 of historical, critical at p99
   - Time-to-merge: warning at p90, critical at p99
   - Finding density: warning at 2x rolling 30-day average
3. **Burn-in period** — run alerts in "info" mode for 7 days. Review false positive rate. Promote to warning/critical only after calibration.
4. **Quarterly review** — recalibrate thresholds quarterly as your efficiency improves. A threshold that was p90 three months ago may be p50 now.

### Alert Count Budget

Following [Grafana's noise reduction guidance](https://grafana.com/docs/grafana/latest/alerting/guides/best-practices/):

| Severity | Max Active Alerts | Rationale                                                                  |
| -------- | ----------------- | -------------------------------------------------------------------------- |
| Critical | 1-2 at a time     | If 3+ critical alerts fire, something systemic is wrong — not alert-worthy |
| Warning  | 3-5 at a time     | Enough for awareness, not overwhelming                                     |
| Info     | Unlimited         | Dashboard annotations only, no notifications                               |

**Total**: ~15 alert rules across all 5 dimensions. This is intentionally minimal. More alerts ≠ more insight — each alert must be actionable or it gets deleted.

### Provisioning File Structure (Updated)

```
monitoring/
├── grafana/
│   ├── provisioning/
│   │   ├── dashboards/
│   │   │   └── dashboards.yml
│   │   ├── datasources/
│   │   │   └── datasources.yml
│   │   └── alerting/                    # NEW
│   │       ├── cost-alerts.yml          # Dimension 1 alert rules
│   │       ├── velocity-alerts.yml      # Dimension 2 alert rules
│   │       ├── quality-alerts.yml       # Dimension 3 alert rules
│   │       ├── compound-alerts.yml      # Dimension 4 alert rules
│   │       ├── agent-alerts.yml         # Dimension 5 alert rules
│   │       ├── contact-points.yml       # Desktop webhook + optional Slack
│   │       ├── notification-policies.yml # Routing by severity
│   │       └── mute-timings.yml         # Exploration session muting
│   └── dashboards/
│       ├── ce-metrics-main.json
│       ├── ce-agent-detail.json
│       └── ce-session-live.json
├── prometheus.yml
└── otel-collector-config.yml
```

## Token Data Access — RESOLVED

**Answer: JSONL transcript files contain per-turn token data.** No API key needed.

Every assistant turn in `~/.claude/projects/{project}/{session-id}.jsonl` contains:

```json
{
  "type": "assistant",
  "message": {
    "model": "claude-opus-4-6",
    "usage": {
      "input_tokens": 2,
      "output_tokens": 9,
      "cache_creation_input_tokens": 16548,
      "cache_read_input_tokens": 36306
    },
    "stop_reason": "end_turn"
  }
}
```

**Verified on this session** (fd3e13e6...):

- 654 turns, 17,285 input tokens, 123,600 output tokens
- Cache read: 75,376,315 / Cache creation: 2,960,194 = **25.5:1 ratio**
- Model: claude-opus-4-6 (all turns)

**Data extraction strategy:**

1. **`Stop` hook** fires after every Claude response → receives `transcript_path` in input JSON → parse last entry for per-turn tokens
2. **`SessionEnd` hook** fires at session end → aggregate all assistant turns in transcript → emit session totals to OTEL
3. **`SubagentStop` hook** fires when agents complete → captures agent-specific token usage
4. **Historical backfill**: Script walks all `*.jsonl` files in `~/.claude/projects/` to reconstruct past session costs. Cross-reference with git log timestamps to map sessions to PRs.

**Cost calculation** (Opus 4.6 pricing):

- Input: $15/M tokens, Output: $75/M tokens
- Cache read: $1.50/M tokens, Cache creation: $18.75/M tokens
- This session estimate: ~$0.03 input + $9.27 output + $113.06 cache read + $55.50 cache creation = ~$177.86

**Third-party tool**: [ccusage](https://github.com/ryoppippi/ccusage) already parses these JSONL files for monthly/session reports.

## Historical Backfill Implementation — RESOLVED

**Scope**: 37 JSONL files, 723.6 MB total, spanning Feb 14 — Mar 4, 2026 (19 days).
**Feasibility**: Fully feasible. Python script processes all files in under a minute.
**Import method**: `promtool tsdb create-blocks-from openmetrics` ([Prometheus docs](https://prometheus.io/docs/prometheus/latest/storage/))

### Backfill Architecture — 3 Scripts

```
scripts/ce-metrics/
├── backfill-sessions.py       # Script 1: Parse JSONL transcripts → session cost/token metrics
├── backfill-quality.py        # Script 2: Parse MEMORY.md → per-PR quality/agent metrics
├── backfill-import.sh         # Script 3: Convert outputs → OpenMetrics → promtool import
└── lib/
    ├── jsonl_parser.py        # Shared JSONL parsing utilities
    ├── memory_parser.py       # MEMORY.md regex-based parser
    ├── pr_mapper.py           # Session-to-PR timestamp correlation
    └── cost_calculator.py     # Token → USD conversion (model-aware pricing)
```

### Script 1: `backfill-sessions.py` — JSONL Transcript Parser

**Input**: `~/.claude/projects/-Users-fp/*.jsonl` (37 files, 723.6 MB)
**Output**: `~/.claude/metrics/backfill/sessions.jsonl` (one record per session)

**Algorithm**:

```python
# Pseudocode — actual implementation in /workflows:work phase
for jsonl_file in glob("~/.claude/projects/-Users-fp/*.jsonl"):
    session_id = stem(jsonl_file)  # UUID from filename
    turns = []

    for line in jsonl_file:
        record = json.loads(line)
        if record["type"] == "assistant" and "usage" in record.get("message", {}):
            usage = record["message"]["usage"]
            turns.append({
                "timestamp": record.get("timestamp"),
                "model": record["message"].get("model", "unknown"),
                "input_tokens": usage.get("input_tokens", 0),
                "output_tokens": usage.get("output_tokens", 0),
                "cache_read": usage.get("cache_read_input_tokens", 0),
                "cache_creation": usage.get("cache_creation_input_tokens", 0),
            })

    if not turns:
        continue  # Skip empty/non-assistant sessions

    # Aggregate
    session = {
        "session_id": session_id,
        "start_time": turns[0]["timestamp"],
        "end_time": turns[-1]["timestamp"],
        "duration_minutes": (end - start).total_seconds() / 60,
        "total_turns": len(turns),
        "model": most_common([t["model"] for t in turns]),
        "input_tokens": sum(t["input_tokens"] for t in turns),
        "output_tokens": sum(t["output_tokens"] for t in turns),
        "cache_read_tokens": sum(t["cache_read"] for t in turns),
        "cache_creation_tokens": sum(t["cache_creation"] for t in turns),
        "estimated_cost_usd": calculate_cost(turns),  # Model-aware pricing
    }

    # PR mapping (timestamp correlation)
    session["pr_number"] = map_session_to_pr(session["start_time"], session["end_time"])
    session["branch"] = get_branch_for_pr(session["pr_number"])

    emit(session)
```

**Cost calculation** (`cost_calculator.py`):

```python
PRICING = {
    "claude-opus-4-6":   {"input": 15.0, "output": 75.0, "cache_read": 1.50, "cache_create": 18.75},
    "claude-sonnet-4-6": {"input": 3.0,  "output": 15.0, "cache_read": 0.30, "cache_create": 3.75},
    "claude-haiku-4-5":  {"input": 0.80, "output": 4.0,  "cache_read": 0.08, "cache_create": 1.0},
}

def calculate_cost(turns):
    total = 0.0
    for t in turns:
        p = PRICING.get(t["model"], PRICING["claude-opus-4-6"])
        total += (t["input_tokens"] * p["input"] / 1_000_000
                + t["output_tokens"] * p["output"] / 1_000_000
                + t["cache_read"] * p["cache_read"] / 1_000_000
                + t["cache_creation"] * p["cache_create"] / 1_000_000)
    return round(total, 2)
```

**PR mapping** (`pr_mapper.py`):

```python
def build_commit_timeline():
    """Build a timeline of commits with their branches and PR numbers."""
    # git log --all --format='%H|%ai|%D|%s' gives hash, date, refs, subject
    # Parse refs to extract branch names
    # Cross-reference with: gh pr list --state merged --json number,headRefName,mergedAt
    # Returns: [{timestamp, pr_number, branch}, ...]

def map_session_to_pr(start_time, end_time):
    """Find which PR was being worked on during this session window."""
    timeline = build_commit_timeline()
    # Find commits made between start_time and end_time
    commits_in_window = [c for c in timeline if start_time <= c.timestamp <= end_time]
    if commits_in_window:
        return commits_in_window[0].pr_number  # Most recent PR

    # Fallback: nearest compound doc by date
    return match_compound_doc(start_time)
```

### Script 2: `backfill-quality.py` — MEMORY.md Parser

**Input**: `~/.claude/projects/-Users-fp/memory/MEMORY.md` (Sprint Learnings Index section)
**Output**: `~/.claude/metrics/backfill/quality.jsonl` (one record per sprint/PR)

**Parsing strategy**: Each sprint entry follows a consistent pattern:

```
- **{Sprint Name} ({date})**: {summary}. PR #{number}, {files} files, +{added}/-{removed}...
```

**Regex-based extraction** (`memory_parser.py`):

```python
import re

SPRINT_PATTERN = re.compile(
    r"- \*\*(?P<name>[^*]+)\s+\((?P<date>[\d/-]+)\)\*\*:\s*(?P<body>.+)"
)

METRICS_PATTERNS = {
    "pr_number": re.compile(r"PR\s*#(\d+)"),
    "files_changed": re.compile(r"(\d+)\s*files?"),
    "lines_added": re.compile(r"\+(\d[\d,]*)"),
    "lines_removed": re.compile(r"-(\d[\d,]*)"),
    "p1_count": re.compile(r"(\d+)\s*P1"),
    "p2_count": re.compile(r"(\d+)\s*P2"),
    "p3_count": re.compile(r"(\d+)\s*P3"),
    "agent_count": re.compile(r"(\d+)\s*(?:domain\s+)?(?:agents?|specialists?|parallel)"),
    "conflicts": re.compile(r"(\d+)\s*(?:merge\s+)?conflicts?"),
    "patterns_added": re.compile(r"(\d+)\s*new\s*patterns?"),
    "tests_pass": re.compile(r"(\d+)(?:/\d+)?\s*tests?\s*pass"),
    "review_agents": re.compile(r"(\d+)-agent\s*review"),
    "findings_total": re.compile(r"(\d+)\s*findings?"),
    "stale_rate": re.compile(r"(\d+)%\s*stale"),
}

def parse_memory_entries(memory_path):
    records = []
    with open(memory_path) as f:
        for line in f:
            m = SPRINT_PATTERN.match(line.strip())
            if not m:
                continue

            body = m.group("body")
            record = {
                "sprint_name": m.group("name").strip(),
                "date": normalize_date(m.group("date")),  # "02-24" → "2026-02-24"
            }

            for key, pattern in METRICS_PATTERNS.items():
                match = pattern.search(body)
                record[key] = int(match.group(1).replace(",", "")) if match else None

            # Derive findings by severity if total but not individual
            if record.get("findings_total") and not record.get("p1_count"):
                record["p1_count"] = 0
                record["p2_count"] = record["findings_total"]
                record["p3_count"] = 0

            records.append(record)

    return records
```

**Expected output per sprint entry**:

```json
{
  "sprint_name": "PR #86 P1 Remediation R4",
  "date": "2026-02-19",
  "pr_number": 86,
  "files_changed": 17,
  "lines_added": 439,
  "lines_removed": null,
  "p1_count": 12,
  "p2_count": 0,
  "p3_count": 0,
  "agent_count": 4,
  "conflicts": 0,
  "patterns_added": 8,
  "tests_pass": 439,
  "review_agents": null,
  "findings_total": 12,
  "stale_rate": null
}
```

**Validation**: The parser will be tested against all 50+ entries in MEMORY.md. Entries that fail to parse are logged for manual review (expected: <5% failure rate given the consistent format).

### Script 3: `backfill-import.sh` — OpenMetrics Import

**Input**: `sessions.jsonl` + `quality.jsonl` from Scripts 1 & 2
**Output**: TSDB blocks in Prometheus data directory

**Step 1**: Convert JSONL to [OpenMetrics text format](https://github.com/OpenObservability/OpenMetrics):

```python
# generate_openmetrics.py
def to_openmetrics(sessions, quality_records):
    lines = []

    # Session cost metrics
    lines.append("# HELP ce_session_cost_usd Total estimated cost per session")
    lines.append("# TYPE ce_session_cost_usd gauge")
    for s in sessions:
        ts_ms = int(s["start_time"].timestamp() * 1000)
        pr = s.get("pr_number", "unknown")
        model = s.get("model", "unknown")
        lines.append(f'ce_session_cost_usd{{pr_number="{pr}",model="{model}",session="{s["session_id"][:8]}"}} {s["estimated_cost_usd"]} {ts_ms}')

    # Token usage metrics
    for token_type in ["input", "output", "cache_read", "cache_creation"]:
        lines.append(f"# HELP ce_session_tokens_{token_type} Total {token_type} tokens per session")
        lines.append(f"# TYPE ce_session_tokens_{token_type} gauge")
        for s in sessions:
            ts_ms = int(s["start_time"].timestamp() * 1000)
            val = s.get(f"{token_type}_tokens", 0)
            lines.append(f'ce_session_tokens_{token_type}{{pr_number="{s.get("pr_number","unknown")}",model="{s.get("model","unknown")}"}} {val} {ts_ms}')

    # Quality metrics from MEMORY.md
    for metric in ["p1_count", "p2_count", "p3_count", "files_changed", "agent_count", "conflicts", "patterns_added"]:
        lines.append(f"# HELP ce_{metric} {metric} per PR sprint")
        lines.append(f"# TYPE ce_{metric} gauge")
        for q in quality_records:
            if q.get(metric) is not None and q.get("pr_number"):
                ts_ms = int(q["date"].timestamp() * 1000)
                lines.append(f'ce_{metric}{{pr_number="{q["pr_number"]}",sprint="{q["sprint_name"]}"}} {q[metric]} {ts_ms}')

    lines.append("# EOF")
    return "\n".join(lines)
```

**Step 2**: Import via promtool:

```bash
#!/bin/bash
# backfill-import.sh

set -euo pipefail

METRICS_DIR="$HOME/.claude/metrics/backfill"
PROM_DATA="/path/to/prometheus/data"  # Docker volume or local path

# Generate OpenMetrics file from JSONL
python3 scripts/ce-metrics/generate_openmetrics.py \
    --sessions "$METRICS_DIR/sessions.jsonl" \
    --quality "$METRICS_DIR/quality.jsonl" \
    --output "$METRICS_DIR/backfill.txt"

# Validate OpenMetrics format
promtool check metrics < "$METRICS_DIR/backfill.txt"

# Create TSDB blocks (2-hour blocks by default)
# --max-block-duration=24h for faster import of 19 days of data
promtool tsdb create-blocks-from openmetrics \
    "$METRICS_DIR/backfill.txt" \
    "$METRICS_DIR/blocks/" \
    --max-block-duration=24h

# Move blocks to Prometheus data directory
# IMPORTANT: Do NOT backfill the last 3 hours (head block overlap)
cp -r "$METRICS_DIR/blocks/"* "$PROM_DATA/"

echo "Backfill complete. Restart Prometheus to load new blocks."
echo "  docker restart prometheus"
```

**Caveat from [Prometheus storage docs](https://prometheus.io/docs/prometheus/latest/storage/)**: "It is not safe to backfill data from the last 3 hours as this may overlap with the current head block." The script filters out any data points within the last 3 hours.

### Session-to-PR Mapping — Detailed Strategy

`gitBranch` in JSONL shows "HEAD" (unreliable). Three fallback strategies, applied in order:

**Strategy 1: Git Log Timestamp Correlation** (primary — expected 80% hit rate)

```bash
# Get all commits with timestamps and branch info
git log --all --format='%H|%ai|%D|%s' --since="2026-02-14" > /tmp/commit-timeline.txt

# Get all merged PRs with their branches
gh pr list --state merged --limit 100 --json number,headRefName,mergedAt,createdAt \
    > /tmp/pr-timeline.json
```

For each session (start_time, end_time), find commits whose timestamp falls within that window. Each commit has a branch ref → each branch maps to a PR via `gh pr list`.

**Strategy 2: Compound Doc Metadata** (fallback — for sessions without commits)

```python
# Parse docs/solutions/**/*.md YAML frontmatter for date and PR references
for doc in glob("docs/solutions/**/*.md"):
    frontmatter = parse_yaml_frontmatter(doc)
    date = frontmatter.get("date")
    # Body often contains "PR: #136" or "- PR: #136"
    pr_match = re.search(r"PR[:\s#]+(\d+)", doc_body)
```

**Strategy 3: MEMORY.md Sprint Entries** (fallback — for orphaned sessions)

```python
# Sprint entries contain PR numbers and dates
# "PR #85 P1/P2 Remediation (02-17)" → PR 85, date 2026-02-17
# Map session date → nearest sprint entry → PR number
```

**Unmapped sessions**: Sessions that can't be mapped to a PR get `pr_number: null` and are visible in Grafana as "Unattributed" in the PR filter dropdown. These typically represent research, brainstorming, or cross-cutting work.

### Data Available Per Session File

| Field                | Location                             | Reliability                                            |
| -------------------- | ------------------------------------ | ------------------------------------------------------ |
| Token usage per turn | `message.usage.*` in assistant turns | High — always present                                  |
| Model per turn       | `message.model`                      | High — always present                                  |
| Timestamps           | `timestamp` on every line            | High — ISO 8601                                        |
| Working directory    | `cwd` on every line                  | High                                                   |
| Branch name          | `gitBranch` field                    | **Low** — shows "HEAD", doesn't resolve to branch name |
| Stop reason          | `message.stop_reason`                | High — `end_turn`, `tool_use`, `max_tokens`            |
| Tool calls           | `type: "tool_use"` entries           | High — can count tool invocations per session          |

### Expected Backfill Output

**37 sessions** → ~37 session records with:

| Metric                    | Expected Range  | Notes                                               |
| ------------------------- | --------------- | --------------------------------------------------- |
| Cost per session          | $0.50 — $200    | Brainstorming sessions are expensive (long context) |
| Total cost (all sessions) | $1,000 — $3,000 | 19 days of intensive development                    |
| Turns per session         | 10 — 700        | Varies with task complexity                         |
| Cache ratio               | 10:1 — 30:1     | Higher for long sessions                            |
| Sessions per PR           | 1 — 5           | Some PRs span multiple sessions                     |

**50+ sprint entries** → ~50 quality records with:

| Metric                 | Expected Range              | Notes                           |
| ---------------------- | --------------------------- | ------------------------------- |
| P1 findings per PR     | 0 — 14                      | Trending downward over time     |
| P2 findings per PR     | 0 — 38                      | Bulk of findings                |
| Files changed per PR   | 2 — 280                     | Wide variance                   |
| Agent count per sprint | 0 (solo) — 8                | 4 is validated sweet spot       |
| Conflict rate          | 0 in 8+ consecutive sprints | Domain-grouped pattern works    |
| Patterns discovered    | 0 — 8 per sprint            | Compound knowledge accumulation |

### Backfill Execution Checklist

```
1. [ ] Ensure Prometheus Docker container is running
2. [ ] Run backfill-sessions.py → generates sessions.jsonl
3. [ ] Run backfill-quality.py → generates quality.jsonl
4. [ ] Manually review unmapped sessions (pr_number: null)
5. [ ] Run generate_openmetrics.py → generates backfill.txt
6. [ ] Validate with: promtool check metrics < backfill.txt
7. [ ] Stop Prometheus briefly (prevents head block conflict)
8. [ ] Run: promtool tsdb create-blocks-from openmetrics backfill.txt ./blocks/ --max-block-duration=24h
9. [ ] Copy blocks to Prometheus data directory
10. [ ] Restart Prometheus
11. [ ] Verify in Grafana: check that historical data appears in time series panels
12. [ ] Run once — this is a one-time migration, not a recurring job
```

## Remaining Open Questions

1. ~~**Alert thresholds**~~ → **RESOLVED** — See "Alerts & Thresholds" section. 15 alert rules, percentile-based thresholds, burn-in calibration.
2. ~~**Retention**~~ → **RESOLVED** — See "Security & Privacy" section. 90-day retention for both JSONL and Prometheus TSDB, 1GB disk cap, daily cron cleanup.
3. ~~**Cost accuracy**~~ → **ACCEPTED** — Estimates from token counts × published pricing. Cache tier pricing (5m vs 1h ephemeral) introduces ~5-10% variance. Acceptable for directional trending — we track relative changes, not absolute billing.

**All open questions resolved. Ready for `/workflows:plan`.**

## Workflow Integration — Hook Deployment Strategy

### Existing Hooks (Must Not Break)

3 hooks already configured in `~/.claude/settings.json`:

| Event           | Matcher                     | Script                    | Purpose                    |
| --------------- | --------------------------- | ------------------------- | -------------------------- |
| `PostToolUse`   | `Edit\|Write\|NotebookEdit` | `auto-commit-config.sh`   | Auto-commit config changes |
| `TaskCompleted` | (none)                      | `verify-task-complete.sh` | Log task completions       |
| `TeammateIdle`  | (none)                      | `check-teammate-done.sh`  | Check teammate status      |

**Compatibility**: Multiple hooks can coexist on the same event. Claude Code runs all matching hooks in parallel. Our metrics hooks are additive — they append to a JSONL file and never return decisions (no block/deny), so they can't interfere with existing hooks.

### Deployment Location: Global User Settings

**Why `~/.claude/settings.json`** (not project or plugin):

- Metrics should track ALL projects, not just Sovren
- Plugin hooks require plugin enable/disable — adds friction
- Project hooks would need to be committed to every repo
- Global hooks fire everywhere, which is what we want for a personal engineering dashboard

### Hook Registration (additions to settings.json)

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash ~/.claude/hooks/ce-metrics/session-start.sh",
            "timeout": 5
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash ~/.claude/hooks/ce-metrics/turn-complete.sh",
            "async": true,
            "timeout": 10
          }
        ]
      }
    ],
    "SubagentStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash ~/.claude/hooks/ce-metrics/agent-spawn.sh",
            "async": true,
            "timeout": 5
          }
        ]
      }
    ],
    "SubagentStop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash ~/.claude/hooks/ce-metrics/agent-complete.sh",
            "timeout": 15
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write|NotebookEdit",
        "hooks": [{ "type": "command", "command": "bash ~/.claude/hooks/auto-commit-config.sh &" }]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "bash ~/.claude/hooks/ce-metrics/git-event.sh",
            "async": true,
            "timeout": 5
          }
        ]
      }
    ],
    "TaskCompleted": [
      {
        "hooks": [
          { "type": "command", "command": "bash ~/.claude/hooks/verify-task-complete.sh" },
          {
            "type": "command",
            "command": "bash ~/.claude/hooks/ce-metrics/task-complete.sh",
            "async": true,
            "timeout": 5
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash ~/.claude/hooks/ce-metrics/session-end.sh",
            "timeout": 30
          }
        ]
      }
    ],
    "TeammateIdle": [
      {
        "hooks": [{ "type": "command", "command": "bash ~/.claude/hooks/check-teammate-done.sh" }]
      }
    ]
  }
}
```

### Script Directory Structure

```
~/.claude/hooks/
├── auto-commit-config.sh          # Existing
├── check-teammate-done.sh         # Existing
├── verify-task-complete.sh        # Existing
└── ce-metrics/                    # NEW — all metrics hooks
    ├── lib.sh                     # Shared functions (read phase, write event, parse tokens)
    ├── session-start.sh           # Detect CE phase, write phase state
    ├── turn-complete.sh           # Per-turn token accumulator (async)
    ├── agent-spawn.sh             # Agent spawn tracking (async)
    ├── agent-complete.sh          # Agent completion with token parsing
    ├── git-event.sh               # Git commit/push/PR detection (async)
    ├── task-complete.sh           # Task resolution tracking (async)
    └── session-end.sh             # Session aggregation → pushgateway
```

### Shared Library (`lib.sh`)

All hooks source this for common functions:

```bash
#!/bin/bash
# ~/.claude/hooks/ce-metrics/lib.sh

METRICS_DIR="$HOME/.claude/metrics"
EVENTS_FILE="$METRICS_DIR/ce-events.jsonl"
PHASE_FILE="$METRICS_DIR/ce-phase.json"

mkdir -p "$METRICS_DIR"

# Read current CE phase from state file
get_phase() {
  if [ -f "$PHASE_FILE" ]; then
    python3 -c "import json; print(json.load(open('$PHASE_FILE')).get('phase','adhoc'))" 2>/dev/null || echo "adhoc"
  else
    echo "adhoc"
  fi
}

# Append event to JSONL log
emit_event() {
  echo "$1" >> "$EVENTS_FILE"
}

# Parse token usage from last assistant turn in a transcript
parse_last_turn_tokens() {
  local transcript="$1"
  python3 -c "
import json, sys
tokens = {'input': 0, 'output': 0, 'cache_read': 0, 'cache_create': 0, 'model': 'unknown'}
with open('$transcript') as f:
    for line in f:
        pass  # get last line
    d = json.loads(line)
    if d.get('type') == 'assistant':
        u = d.get('message', {}).get('usage', {})
        tokens['input'] = u.get('input_tokens', 0)
        tokens['output'] = u.get('output_tokens', 0)
        tokens['cache_read'] = u.get('cache_read_input_tokens', 0)
        tokens['cache_create'] = u.get('cache_creation_input_tokens', 0)
        tokens['model'] = d.get('message', {}).get('model', 'unknown')
print(json.dumps(tokens))
" 2>/dev/null || echo '{"input":0,"output":0,"cache_read":0,"cache_create":0,"model":"unknown"}'
}
```

### CE Phase Detection via Skill Hooks

Instead of detecting phases from transcript parsing (fragile), use **skill-scoped hooks** defined in the CE workflow skill frontmatter:

```yaml
# In each CE workflow skill (plan.md, work.md, review.md, compound.md)
---
hooks:
  SessionStart:
    - hooks:
        - type: command
          command: |
            echo '{"phase":"plan","started_at":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' > ~/.claude/metrics/ce-phase.json
          once: true
---
```

**Why skill hooks**: They fire ONLY when the skill is invoked, so phase detection is 100% accurate. The `once: true` flag ensures it runs only at skill activation, not on every session resume. This is the cleanest integration — no modification to the skill content, just frontmatter.

**Fallback**: If no skill hook has fired (adhoc work outside CE workflows), the global hooks tag events as `phase: "adhoc"`.

### Performance Budget

| Hook                | Async?    | Target Latency | Risk                                                                   |
| ------------------- | --------- | -------------- | ---------------------------------------------------------------------- |
| `session-start.sh`  | No (sync) | <100ms         | Low — runs once, writes one file                                       |
| `turn-complete.sh`  | **Yes**   | <500ms         | Medium — parses JSONL tail. Async = no UX impact                       |
| `agent-spawn.sh`    | Yes       | <50ms          | Low — simple append                                                    |
| `agent-complete.sh` | No (sync) | <2s            | Medium — parses agent transcript. Sync because SubagentStop fires once |
| `git-event.sh`      | Yes       | <100ms         | Low — regex match + append                                             |
| `task-complete.sh`  | Yes       | <50ms          | Low — simple append                                                    |
| `session-end.sh`    | No (sync) | <5s            | Medium — full transcript aggregation + pushgateway POST                |

**Total overhead per turn**: ~0ms (turn-complete is async).
**Total overhead per session**: <10s (all concentrated at session end).

### Disable Switch

If metrics collection causes issues, one toggle disables all CE metrics hooks:

```bash
# Create sentinel file to disable
touch ~/.claude/metrics/.disabled

# All ce-metrics scripts check for this at the top:
[ -f "$HOME/.claude/metrics/.disabled" ] && exit 0
```

## Security & Privacy — RESOLVED

### Threat Model

This is a **single-developer, local-only** metrics system. The threat model is narrow:

| Threat                             | Risk                                    | Mitigation                                                  |
| ---------------------------------- | --------------------------------------- | ----------------------------------------------------------- |
| Metrics data leaks to public       | Low — all local, no cloud export        | No remote endpoints; Grafana bound to `localhost`           |
| JSONL transcripts contain secrets  | Medium — users paste env vars, API keys | Hooks extract ONLY numeric aggregates, never content        |
| Work pattern surveillance          | Low — single dev, no employer           | Relevant if adopted by teams — document data collected      |
| Prometheus/Grafana vulnerabilities | Low — local Docker, no ingress          | No port exposure beyond localhost; Docker network isolation |
| Stale data accumulation            | Low — disk space waste                  | Retention policy + automated cleanup                        |

### Data Classification

What our hooks extract vs. what they explicitly DO NOT extract:

**COLLECTED** (numeric aggregates only):

| Data Point                                 | Sensitivity | Why Needed                 |
| ------------------------------------------ | ----------- | -------------------------- |
| Token counts (input/output/cache)          | None        | Cost calculation           |
| Model name (opus/sonnet/haiku)             | None        | Cost breakdown by tier     |
| Timestamps (ISO 8601)                      | Low         | Duration, velocity metrics |
| Session ID (UUID)                          | None        | Session grouping           |
| Agent type (e.g., "kieran-rails-reviewer") | None        | Agent efficiency tracking  |
| PR number                                  | None        | Sprint grouping            |
| Branch name                                | Low         | PR attribution             |
| Task subject (from TaskCompleted)          | Low         | Task tracking              |
| Git command type (commit/push/merge)       | None        | Velocity events            |
| Commit SHA                                 | None        | PR correlation             |
| Finding severity (P1/P2/P3)                | None        | Quality tracking           |

**NEVER COLLECTED** — hardcoded exclusions in hooks:

| Data Point                                   | Why Excluded                                             | How Enforced                                                                    |
| -------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `tool_input.command` (full Bash command)     | May contain secrets, credentials, env vars               | PostToolUse hook only checks `startsWith("git ")` — never logs the full command |
| `tool_result` (command output)               | May contain API responses, file contents, secrets        | Never read by any hook                                                          |
| `last_assistant_message` (Claude's response) | Contains code, explanations, potentially PII             | Never read — hooks use token counts from `message.usage`, not content           |
| File contents (from Read/Edit tools)         | Source code, configs with secrets                        | PostToolUse hook only fires on Bash matcher — no file tool hooks                |
| `task_description`                           | May contain detailed instructions with sensitive context | Only `task_subject` is logged (short title)                                     |
| User prompts / conversation content          | Private work context, potentially PII                    | Never accessed — hooks parse `message.usage` metadata only                      |
| Agent transcript content                     | Agent conversation may contain secrets                   | Only token aggregates parsed from `agent_transcript_path` — content never read  |

### Hook Security Rules (enforced in `lib.sh`)

```bash
# Rule 1: NEVER log tool_input or tool_result content
# The PostToolUse hook receives these but MUST only pattern-match, never store
emit_git_event() {
    local command="$1"
    # Only extract the verb, NEVER the full command
    case "$command" in
        git\ commit*) echo '{"event":"git_commit"}' ;;
        git\ push*)   echo '{"event":"git_push"}' ;;
        gh\ pr\ merge*) echo '{"event":"pr_merge"}' ;;
        *)            return 0 ;;  # Silently ignore non-git commands
    esac
}

# Rule 2: NEVER read message content from transcripts
# Only parse the structured `usage` field
parse_tokens_only() {
    local transcript="$1"
    # Uses python3 to read ONLY message.usage fields
    # The script NEVER accesses message.content, tool results, or user prompts
    python3 -c "
import json
# Read ONLY the last line's usage data
with open('$transcript') as f:
    for line in f: pass
d = json.loads(line)
u = d.get('message',{}).get('usage',{})
# Output ONLY numeric fields — no strings from content
print(json.dumps({
    'input': u.get('input_tokens',0),
    'output': u.get('output_tokens',0),
    'cache_read': u.get('cache_read_input_tokens',0),
    'cache_create': u.get('cache_creation_input_tokens',0),
    'model': d.get('message',{}).get('model','unknown')
}))
" 2>/dev/null
}

# Rule 3: Sanitize task subjects (strip potential secrets)
sanitize_subject() {
    # Remove anything that looks like a token, key, or credential
    echo "$1" | sed -E 's/[A-Za-z0-9_-]{32,}/[REDACTED]/g'
}
```

### Local-Only Guarantees

```
All data stays on localhost. No exceptions.

┌─────────────────────────────────────────────────────────────┐
│ Your Machine (localhost only)                                │
│                                                              │
│  ~/.claude/metrics/                                          │
│  ├── ce-events.jsonl      ← Numeric aggregates only          │
│  ├── ce-phase.json        ← Current phase state              │
│  └── backfill/            ← One-time import data             │
│                                                              │
│  Docker Network (bridge, no port forwarding to 0.0.0.0)     │
│  ├── Prometheus  :9090    ← Bound to 127.0.0.1              │
│  ├── Grafana     :3001    ← Bound to 127.0.0.1              │
│  └── Pushgateway :9091    ← Bound to 127.0.0.1              │
│                                                              │
│  No outbound connections. No cloud sync. No telemetry.       │
└─────────────────────────────────────────────────────────────┘
```

**Docker network configuration** (enforced in docker-compose):

```yaml
services:
  prometheus:
    ports:
      - '127.0.0.1:9090:9090' # Bind to localhost ONLY
  grafana:
    ports:
      - '127.0.0.1:3001:3000' # Bind to localhost ONLY
  pushgateway:
    ports:
      - '127.0.0.1:9091:9091' # Bind to localhost ONLY
```

The `127.0.0.1:` prefix ensures Docker does NOT expose these ports on all interfaces. Without it, Docker binds to `0.0.0.0` which exposes to the local network.

### Grafana Access Control

For single-developer use, Grafana runs with default anonymous access (no login needed). If this becomes a team tool:

```yaml
# grafana/grafana.ini (or environment variables)
[auth.anonymous]
enabled = false

[auth.basic]
enabled = true

[security]
admin_user = ce-admin
admin_password = ${GF_SECURITY_ADMIN_PASSWORD}  # From .env, never committed
```

### Data Retention Policy

| Data               | Retention              | Mechanism                                                              | Rationale                                       |
| ------------------ | ---------------------- | ---------------------------------------------------------------------- | ----------------------------------------------- |
| `ce-events.jsonl`  | 90 days                | Cron job: `find ~/.claude/metrics/ -name "*.jsonl" -mtime +90 -delete` | Enough for quarterly trend analysis             |
| Prometheus TSDB    | 90 days                | `--storage.tsdb.retention.time=90d` flag                               | Matches JSONL retention                         |
| Grafana dashboards | Indefinite             | Version-controlled in repo                                             | No sensitivity — just panel configs             |
| Backfill data      | Delete after import    | One-time use; `rm -rf ~/.claude/metrics/backfill/`                     | No reason to keep intermediate files            |
| JSONL transcripts  | Managed by Claude Code | We don't manage these — Claude Code handles lifecycle                  | Our hooks only read, never write to transcripts |

**Retention automation**:

```bash
# Add to crontab: daily cleanup at midnight
0 0 * * * find $HOME/.claude/metrics/ -name "ce-events*.jsonl" -mtime +90 -delete 2>/dev/null
```

**Prometheus retention flag** (in docker-compose):

```yaml
prometheus:
  command:
    - '--storage.tsdb.retention.time=90d'
    - '--storage.tsdb.retention.size=1GB' # Also cap by disk size
    - '--web.enable-otlp-receiver'
```

### .gitignore Protection

The metrics data directory MUST NOT be committed to any repository:

```gitignore
# Already in global gitignore or project .gitignore
.claude/metrics/
```

Verify: `grep -q "metrics" ~/.gitignore_global || echo '.claude/metrics/' >> ~/.gitignore_global`

### Team Adoption Considerations

If this system is later adopted for team metrics (multiple developers reporting to a shared Grafana):

1. **Opt-in only** — developers must explicitly enable hooks. Never auto-enable.
2. **Anonymization option** — strip developer identity, show only aggregate team metrics
3. **No individual comparison** — dashboard should show team trends, not leaderboards
4. **Data ownership** — each developer's data stays on their machine; only aggregates are pushed to shared Prometheus
5. **Manager visibility controls** — if a shared instance exists, developers control what metrics are visible to others
6. **Right to delete** — any developer can `touch ~/.claude/metrics/.disabled` and `rm -rf ~/.claude/metrics/ce-events*` to stop and purge

These considerations are documented now but NOT implemented in MVP — single-developer use only.

## What This Is NOT

- Not a replacement for compound docs (those capture _what_ was learned; this tracks _how efficiently_)
- Not a code quality dashboard (that already exists via quality-metrics.ts types)
- Not a production monitoring tool (deployment-monitoring.ts handles that)
- This is specifically about **CE workflow efficiency and knowledge compounding**

## Next Steps

Run `/workflows:plan` to create the implementation plan. Key phases:

1. Docker monitoring stack setup (OTEL + Prometheus + Grafana)
2. Hook infrastructure (OTEL exporter module for Claude Code hooks)
3. Grafana dashboard provisioning (JSON dashboard configs)
4. Workflow integration (embed hooks in existing CE commands)
5. Historical backfill script (optional — mine MEMORY.md for baselines)
