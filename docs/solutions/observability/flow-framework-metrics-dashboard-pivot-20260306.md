---
title: Flow Framework Metrics Dashboard — Pivot from Session Introspection to Delivery Outcomes
date: '2026-03-06'
category: observability
tags: [metrics, grafana, flow-framework, dashboard, github-api, prometheus, pushgateway, hooks]
module: monitoring/grafana
severity: P2
symptoms:
  - CE Metrics Dashboard (22 panels) showed noisy session-level data with limited actionability
  - Session labels were hex IDs; PR mapping inconsistent; all phases showed "adhoc"
  - Knowledge Compounding and Agent Efficiency panels showed "No data" or identical values
  - Metrics didn't answer "Are we shipping effectively?"
root_cause: |
  Dashboard measured Claude Code implementation internals (tokens, agents, cache, phases)
  rather than engineering outcomes (shipping speed, quality balance, WIP). After fixing
  data pipeline bugs, the metrics themselves lacked signal — session introspection is
  diagnostic, not strategic. Flow Framework provides the right abstraction.
---

# Flow Framework Metrics Dashboard — Pivot from Session Introspection

## Problem

Built a CE Metrics Dashboard with 22 Grafana panels across 5 dimensions (Cost, Velocity, Quality, Knowledge Compounding, Agent Efficiency). Multiple data pipeline issues: session labels were hex IDs, PR mapping broken, phase detection showing 100% "adhoc", Knowledge panels empty. After fixing all data issues, the user observed the metrics themselves weren't answering useful questions.

## Root Cause

Two fundamental misalignments:

1. **Measuring internals, not outcomes**: Token counts, agent spawns, and cache behavior are internal to Claude Code. They optimize for tool efficiency, not team productivity.
2. **Session-level granularity masked PR-level reality**: Sessions capture single tasks. What matters is: How long does each PR take? Are we shipping faster? Is WIP limiting us?

## Solution

Pivoted to **Flow Framework** metrics (Mik Kersten's "Project to Product"):

### 4 Flow Metrics

| Metric              | What It Measures              | Data Source                       | Healthy Range    |
| ------------------- | ----------------------------- | --------------------------------- | ---------------- |
| **Flow Velocity**   | PRs merged per week           | `gh pr list --state merged`       | 5-15 PRs/week    |
| **Flow Time**       | Hours from PR create to merge | GitHub API `createdAt`/`mergedAt` | Median <8h       |
| **Flow Efficiency** | Active work ratio (CE phases) | `ce-events.jsonl` phase counts    | 15-30%           |
| **Flow Load**       | Current open PRs (WIP)        | `gh pr list --state open`         | 1-3 for solo dev |

### Implementation

**`scripts/ce-metrics/flow-metrics.sh`** (~250 lines):

```bash
# Collects all 4 flow metrics from GitHub API + CE events
bash scripts/ce-metrics/flow-metrics.sh          # Run once
bash scripts/ce-metrics/flow-metrics.sh --watch   # Every 5 minutes
```

Three collection functions:

- `collect_flow_load()` — queries `gh pr list --state open`, pushes `flow_load` gauge
- `collect_flow_velocity_and_time()` — fetches last 100 merged PRs, computes weekly velocity, per-PR flow time, median/avg/P90 aggregates
- `collect_flow_efficiency()` — reads `ce-events.jsonl`, counts phase occurrences, computes `work_events / total_events`

### Dashboard Rebuild

From 22 panels → 12 panels across 5 rows:

- **Row 0: Flow KPIs** — 4 stat panels (velocity, time, load, efficiency)
- **Row 1: Velocity** — weekly bar chart + 4-week total + lines changed per PR
- **Row 2: Flow Time** — per-PR bar chart (sorted) + distribution stats
- **Row 3: Efficiency** — phase pie chart + explanation
- **Row 4: Flow Load** — WIP gauge + Little's Law guidance

### Key Decisions

| Decision                                | Rationale                                      |
| --------------------------------------- | ---------------------------------------------- |
| GitHub API as source, not Claude events | PR data is authoritative. Events are ephemeral |
| Flow Framework over custom 5-dimensions | Proven framework. Answers business questions   |
| 4 metrics, not 22 panels                | Fewer metrics force clarity                    |
| Weekly granularity                      | Matches planning cycles. Per-turn is noise     |
| Standalone script, not hook integration | Flow metrics source GitHub (separate concern)  |

### Infrastructure Fixes (Along the Way)

Three issues fixed before the pivot:

1. **Session labels**: Switched from Claude hex IDs to git branch slugs via `get_work_slug()` in `lib.sh`
2. **Phase detection**: `SessionStart` frontmatter hooks fire once at session start, not when command invoked mid-session. Fix: inline `bash set-phase.sh <phase>` in each workflow command body
3. **Context re-injection**: New SessionStart hook (`context-reinject.sh`) echoes top 5 patterns from `common-solutions.md` into every new session

## Prevention

See `docs/solutions/process-issues/prevention-metrics-dashboard-design-20260305.md` for comprehensive prevention strategies.

Key principles:

- **Start with the question, not the data**: "What decision does this metric enable?"
- **Measure outcomes (PRs shipped) not activity (tokens spent)**
- **Use authoritative sources**: GitHub API > self-reported events
- **Fewer metrics, more signal**: 4 focused > 22 noisy

## Files Changed

| File                                                 | Change                          |
| ---------------------------------------------------- | ------------------------------- |
| `scripts/ce-metrics/flow-metrics.sh`                 | NEW — collects 4 flow metrics   |
| `monitoring/grafana/dashboards/ce-metrics-main.json` | REBUILT — 22 → 12 panels        |
| `scripts/ce-metrics/hooks/context-reinject.sh`       | NEW — pattern re-injection hook |
| `scripts/ce-metrics/hooks/lib.sh`                    | ADDED `get_work_slug()`         |
| `scripts/ce-metrics/hooks/session-end.sh`            | Branch slug labels, date label  |
| 5 workflow `.md` files                               | Inline phase detection          |
| `scripts/ce-metrics/install-hooks.sh`                | Added context-reinject.sh       |

## Related

- Plan: `docs/plans/2026-03-04-feat-ce-metrics-dashboard-plan.md`
- Brainstorm: `docs/brainstorms/2026-03-04-ce-metrics-dashboard-brainstorm.md`
- Prevention: `docs/solutions/process-issues/prevention-metrics-dashboard-design-20260305.md`
- PR #138: CE Metrics Dashboard
- Patterns: common-solutions.md #91-#97
