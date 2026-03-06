---
title: 'Full Agent Monitoring System — Session-Scoped Hooks + Grafana Dashboard'
date: 2026-03-06
category: observability
tags:
  [
    hooks,
    metrics,
    grafana,
    session-scoping,
    data-quality,
    claude-code,
    concurrent-sessions,
    phase-detection,
  ]
module: ~/.claude/hooks/ce-metrics/, ~/.claude/hooks/enforcement/, monitoring/grafana/
pr: 142
severity: P1 (data quality), P2 (coverage gaps)
sprint: 'Agent Monitoring (03-06)'
---

# Full Agent Monitoring System

## Problem

Claude Code observability hooks were deployed but producing unusable data:

1. **91% of events tagged "adhoc"** — phase detection wasn't working despite hooks being in place
2. **Zero tokens in turn_complete/agent_complete events** — transcript parsing broken
3. **Missing 5 high-value hook events** — no visibility into tool calls, failures, compactions, or teammate idle
4. **Dashboard showed broken data** — hex session IDs, no phase breakdown, stale metrics

## Root Causes (3 bugs in phase pipeline)

### Bug 1: SessionStart resets phase on resume

`session-start.sh` unconditionally set phase to "adhoc" on every `SessionStart` event. **SessionStart fires multiple times per session** — on resume, reconnection, and context window recovery (one session had 10 fires). Each fire wiped the workflow phase set by `phase-detect-context.sh`.

```bash
# BEFORE (broken): always resets
echo '{"phase":"adhoc","branch":"..."}' > "$CE_PHASE_FILE"

# AFTER (fixed): preserve on resume
if [ -f "$CE_PHASE_FILE" ]; then
  # Resume — only update branch
  jq --arg branch "$branch" '.branch = $branch' "$CE_PHASE_FILE" > tmp && mv tmp "$CE_PHASE_FILE"
else
  # New session — create with adhoc default
  echo "{\"phase\":\"adhoc\",\"branch\":\"$branch\"}" > "$CE_PHASE_FILE"
fi
```

### Bug 2: All sessions share one phase file

All concurrent sessions read/wrote a single `~/.claude/metrics/ce-phase.json`. When session B's SessionStart fired, it overwrote session A's "work" phase back to "adhoc".

**Fix**: Session-scoped phase files at `~/.claude/metrics/phases/{session_id}.json`. Updated `get_phase()`, `get_project()`, and `emit_event()` to accept and pass `session_id`.

```bash
# Session-scoped phase file path
CE_PHASE_FILE="$CE_PHASE_DIR/${session_id}.json"

# get_phase() checks session-scoped file first
get_phase() {
  local sid="${1:-}"
  if [ -n "$sid" ] && [ -f "$CE_PHASE_DIR/${sid}.json" ]; then
    jq -r '.phase // "adhoc"' "$CE_PHASE_DIR/${sid}.json"
  elif [ -f "$CE_PHASE_FILE" ]; then
    jq -r '.phase // "adhoc"' "$CE_PHASE_FILE"
  else
    echo "adhoc"
  fi
}
```

### Bug 3: Phase detection patterns too narrow

`phase-detect-context.sh` only matched `/workflows:plan` but skills arrive as `/compound-engineering:workflows:plan`, `/team-builder`, `/slfg`, etc.

```bash
# BEFORE: missed most invocations
case "$prompt" in
  /workflows:plan)   new_phase="plan" ;;
  /workflows:work)   new_phase="work" ;;
esac

# AFTER: catches all forms
case "$prompt" in
  *workflows:plan*|*deepen-plan*|*plan_review*)  new_phase="plan" ;;
  *workflows:work*|*/team-builder*|*/slfg*|*/lfg*) new_phase="work" ;;
  *workflows:review*|*/triage*|*/resolve_parallel*) new_phase="review" ;;
  *workflows:compound*|*/compound-docs*)  new_phase="compound" ;;
  *workflows:brainstorm*|*/brainstorming*) new_phase="brainstorm" ;;
esac
```

## What Was Built

### Phase 1: Data Quality Fixes

- Session-scoped phase files (`~/.claude/metrics/phases/{session_id}.json`)
- `lib.sh`: `get_phase(session_id)`, `get_project(session_id)`, `emit_event()` passes session_id
- `session-start.sh`: preserves phase on resume, creates only on new session
- `phase-detect-context.sh`: expanded to 15+ skill/workflow patterns
- `set-phase.sh`: accepts optional session_id, updates all active sessions when omitted
- `session-end.sh`: cleans up session phase file + stale files >48h
- `branch-discipline.sh`: tries session-scoped phase file before legacy

### Phase 2: 5 New Hook Scripts

| Script                       | Event                   | Captures                                                       |
| ---------------------------- | ----------------------- | -------------------------------------------------------------- |
| `tool-call-start.sh`         | PreToolUse (all tools)  | tool_name, tool_category (read/write/search/execute/agent/mcp) |
| `tool-call-complete.sh`      | PostToolUse (all tools) | tool_name, tool_use_id                                         |
| `tool-failure-logger.sh`     | PostToolUseFailure      | tool_name, sanitized error (first 200 chars)                   |
| `context-compact-tracker.sh` | PreCompact              | context pressure signal                                        |
| `teammate-idle-tracker.sh`   | TeammateIdle            | teammate_name, team_name                                       |

All registered in `~/.claude/settings.json`. Security: never log tool_input.command, file contents, or prompts.

### Phase 3: Grafana Agent Monitor Dashboard

19 panels, 5 rows, 3 template variables (`$project`, `$session`, `$phase`):

| Row                | Panels                                                                         |
| ------------------ | ------------------------------------------------------------------------------ |
| Session Overview   | Cost (USD), turns, agents spawned, tasks completed, compactions                |
| Tool Activity      | Calls by category (bar), failure rate (gauge), failures (stat), commits (stat) |
| Agent Team         | Avg duration (stat), idle events (stat), efficiency ratio (stat)               |
| Token Usage & Cost | 4 token type stats, token breakdown (bar), cost breakdown (bar)                |
| Session Comparison | Table with all sessions: cost, turns, agents, tasks, commits                   |

File: `monitoring/grafana/dashboards/ce-agent-monitor.json` (924 lines)

## Key Patterns

### NEW: Session-Scoped State for Concurrent Hook Isolation

**When**: Multiple Claude Code sessions run concurrently (squad worktrees, team agents).
**Problem**: Shared state files (`ce-phase.json`) get clobbered by whichever session writes last.
**Fix**: Per-session files at `{dir}/{session_id}.json`. All state readers accept `session_id` parameter.
**Cleanup**: Session-end hook deletes own file; cron-style cleanup for stale files >48h.

### REFINED: SessionStart Fires Multiple Times (#92)

Pattern #92 stated "SessionStart Hook Fires Once" — **this is incorrect**. SessionStart fires on every resume/reconnection (observed 3-10 fires per session). Hooks triggered by SessionStart must be **idempotent** — check for existing state before resetting.

### REFINED: Phase Detection Must Match Skill Invocations (#100)

Pattern #100 (deterministic hooks replace LLM instructions) works but pattern matching must account for the full namespace path. Skills arrive as both `/workflows:plan` and `/compound-engineering:workflows:plan`. Use `*workflows:plan*` glob (substring match) not `^/workflows:plan$` (exact match).

### NEW: Lightweight Hooks Need Explicit Session Threading

Hooks that bypass `ce_init()` for performance (tool-call-start.sh, tool-call-complete.sh) must still pass `session_id` to `emit_event()` → `get_phase()`. The session_id comes from the hook's stdin JSON payload, not from environment variables.

## Verification (DoD)

| Criterion                       | Result                                           |
| ------------------------------- | ------------------------------------------------ |
| Non-zero tokens in events       | PASS (6 events with token data)                  |
| Monitoring stack healthy        | PASS (prometheus, pushgateway, grafana)          |
| tool_start/tool_complete events | PASS (Read, Bash, Edit, Write, Grep, TaskUpdate) |
| tool_failure events             | PASS (13 events, sanitized errors)               |
| context_compact events          | PASS (1 event)                                   |
| teammate_idle events            | N/A (requires team session, hook wired)          |
| Phase tagging non-adhoc         | PASS (100% "work" after fix, 28/28 events)       |
| Agent Monitor dashboard loads   | PASS (19 panels, real data)                      |
| Prometheus has session data     | PASS (39 sessions, 156 non-zero token metrics)   |

## Files Modified

**~/.claude/ (zone17/claude-config)** — auto-committed:

- `hooks/ce-metrics/lib.sh` — session-scoped phase, get_phase(sid), get_project(sid)
- `hooks/ce-metrics/session-start.sh` — preserve phase on resume
- `hooks/ce-metrics/session-end.sh` — session cleanup + stale file pruning
- `hooks/ce-metrics/set-phase.sh` — rewritten with session_id support
- `hooks/ce-metrics/tool-call-start.sh` — NEW (PreToolUse)
- `hooks/ce-metrics/tool-call-complete.sh` — NEW (PostToolUse)
- `hooks/ce-metrics/tool-failure-logger.sh` — NEW (PostToolUseFailure)
- `hooks/ce-metrics/context-compact-tracker.sh` — NEW (PreCompact)
- `hooks/ce-metrics/teammate-idle-tracker.sh` — NEW (TeammateIdle)
- `hooks/enforcement/phase-detect-context.sh` — expanded patterns + session-scoped
- `hooks/enforcement/branch-discipline.sh` — session-scoped phase lookup
- `settings.json` — 5 new hook registrations

**~/Desktop/Sovren/** — PR #142:

- `monitoring/grafana/dashboards/ce-agent-monitor.json` — NEW (19 panels)
- `packages/frontend/.env.development` — empty stub for docker-compose
- `packages/backend/.env.development` — empty stub for docker-compose

## Cross-References

- [Enforcement Hooks Implementation](../infrastructure/enforcement-hooks-implementation.md) — 7 enforcement hooks, patterns #98-#102
- [Flow Framework Metrics Dashboard Pivot](./flow-framework-metrics-dashboard-pivot-20260306.md) — patterns #91-#97
- [Agent Metrics Infrastructure Hardening](./agent-metrics-infrastructure-hardening-20260306.md) — modular collectors
- [Monitoring Baseline Gap Closing](../infrastructure/monitoring-baseline-gap-closing-20260226.md) — Winston, Prometheus, health endpoints
