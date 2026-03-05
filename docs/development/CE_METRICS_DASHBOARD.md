# CE Metrics Dashboard

Compound Engineering (CE) metrics pipeline: session-level token/cost tracking → Pushgateway → Prometheus → Grafana.

---

## Quick Start

```bash
# Start monitoring stack (Prometheus + Pushgateway + Grafana)
docker compose -f docker-compose.dev.yml --profile monitoring up -d

# Install CE hook scripts (one-time setup)
bash scripts/ce-metrics/install-hooks.sh

# Push synthetic data to verify dashboard renders
bash scripts/ce-metrics/seed-test-data.sh

# Open dashboard
open http://localhost:3002
```

> Grafana runs at **port 3002** (not 3001). Anonymous access is enabled — no login required.

---

## Architecture

```
Claude Code session
       │
       ▼ (bash hooks in ~/.claude/hooks/ce-metrics/)
~/.claude/metrics/ce-events.jsonl    ← structured event log (~140KB typical)
       │
       ▼ (session-end.sh aggregates, curl pushes)
Pushgateway :9091
       │
       ▼ (Prometheus scrapes every 15s)
Prometheus :9090
       │
       ▼
Grafana :3002  →  CE Metrics Dashboard
```

**Key design principle**: session-end.sh reads from `ce-events.jsonl` (~140KB), never from the transcript (up to 723MB). All per-turn events are accumulated in the JSONL file during the session.

---

## Hook Scripts

All hooks live in `scripts/ce-metrics/hooks/` (canonical) and are installed to `~/.claude/hooks/ce-metrics/`.

| Script              | Trigger           | Timeout    | Purpose                                                 |
| ------------------- | ----------------- | ---------- | ------------------------------------------------------- |
| `session-start.sh`  | SessionStart      | 5s (sync)  | Initialize `ce-phase.json`, rotate JSONL if >10MB       |
| `turn-complete.sh`  | Stop              | async      | Parse last-turn tokens from transcript via `tail -1`    |
| `agent-spawn.sh`    | SubagentStart     | async      | Emit `agent_spawn` event with agent_id + agent_type     |
| `agent-complete.sh` | SubagentStop      | 15s (sync) | Aggregate agent transcript tokens + duration            |
| `git-event.sh`      | PostToolUse[Bash] | async      | Classify git commands by first 30 chars only (security) |
| `task-complete.sh`  | TaskCompleted     | async      | Emit `task_complete` with sanitized subject             |
| `session-end.sh`    | SessionEnd        | 60s (sync) | Aggregate JSONL → push Prometheus gauges to Pushgateway |

### lib.sh — Shared Functions

`scripts/ce-metrics/hooks/lib.sh` is sourced by all hooks. Key functions:

- `ce_check_disabled()` — exits 0 if `~/.claude/metrics/.disabled` exists
- `emit_event()` — appends JSON line to `ce-events.jsonl` atomically via `{ printf '%s\n' "$json"; }`
- `get_phase()` — reads `ce-phase.json` via `jq` (python3 fallback)
- `parse_last_turn_tokens()` — `tail -1 transcript | jq -c` (O(1), never reads full file)
- `push_to_gateway()` — curl with 2s connect / 5s max; saves to `pending/` on failure
- `replay_pending()` — called on next successful push to drain failed payloads
- `sanitize_subject()` — strips `key=VALUE` patterns and 40+ char base64 strings

### Phase Detection

CE workflow phase (`plan`, `work`, `review`, `compound`, `adhoc`) is set by the workflow skill files:

- `/workflows:plan` → writes `{"phase":"plan",...}` to `ce-phase.json`
- `/workflows:work` → `{"phase":"work",...}`
- `/workflows:review` → `{"phase":"review",...}`
- `/workflows:compound` → `{"phase":"compound",...}`

If no CE skill is invoked, all events are tagged `adhoc`. session-end.sh warns to stderr if >90% of events are `adhoc`.

### Disable Toggle

```bash
# Disable all metrics collection
touch ~/.claude/metrics/.disabled

# Re-enable
rm ~/.claude/metrics/.disabled
```

---

## Event Log Format

Events are appended to `~/.claude/metrics/ce-events.jsonl` (one JSON object per line):

```jsonl
{"type":"session_start","timestamp":"2026-03-04T22:00:00Z","session_id":"abc123","phase":"adhoc","project":"Sovren"}
{"type":"turn_complete","timestamp":"2026-03-04T22:00:05Z","session_id":"abc123","phase":"plan","project":"Sovren","input_tokens":1500,"output_tokens":300,"cache_read_tokens":200,"model":"claude-opus-4-6"}
{"type":"agent_spawn","timestamp":"2026-03-04T22:01:00Z","session_id":"abc123","phase":"work","project":"Sovren","agent_id":"agent-xyz","agent_type":"backend"}
{"type":"agent_complete","timestamp":"2026-03-04T22:05:00Z","session_id":"abc123","phase":"work","project":"Sovren","agent_id":"agent-xyz","agent_type":"backend","input_tokens":45000,"output_tokens":8200,"turns":18,"duration_seconds":240}
{"type":"git_commit","timestamp":"2026-03-04T22:06:00Z","session_id":"abc123","phase":"work","project":"Sovren","pr_number":""}
{"type":"task_complete","timestamp":"2026-03-04T22:06:30Z","session_id":"abc123","phase":"work","project":"Sovren","task_id":"7","task_subject":"Create session-start.sh","team_name":"squad-a"}
```

The file rotates to `ce-events.jsonl.1` when it exceeds 10MB.

---

## Prometheus Metrics

All metrics are pushed as **gauges** (not counters — pushgateway gauges don't support `rate()`/`increase()`).

| Metric                     | Labels                                               | Description             |
| -------------------------- | ---------------------------------------------------- | ----------------------- |
| `ce_session_tokens_total`  | `type` (input/output), `session`, `phase`, `project` | Token count for session |
| `ce_session_turns_total`   | `session`, `phase`, `project`                        | Turn count              |
| `ce_session_agents_total`  | `session`, `phase`, `project`                        | Agents spawned          |
| `ce_session_tasks_total`   | `session`, `phase`, `project`                        | Tasks completed         |
| `ce_session_commits_total` | `session`, `phase`, `project`                        | Git commits             |

Metrics are pushed per-session to `http://localhost:9091/metrics/job/ce_session/instance/{session_short}`.

---

## Dashboard — 6 Rows, 19 Panels

Access at **http://localhost:3002** → CE Metrics Dashboard.

### Template Variables

| Variable      | Source                          | Description                   |
| ------------- | ------------------------------- | ----------------------------- |
| `$project`    | `ce_session_tokens_total` label | Filter by project             |
| `$phase`      | `ce_session_tokens_total` label | Filter by CE phase            |
| `$session`    | `ce_session_tokens_total` label | Drill into single session     |
| `$time_range` | Built-in                        | Grafana time range            |
| `$interval`   | Built-in                        | Auto interval for time series |

### Row 1 — Project-Level KPIs (4 stat panels)

| Panel             | Query                                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| Total Cost        | `sum(ce_session_tokens_total{type="input"} * 0.000015 + ce_session_tokens_total{type="output"} * 0.000075)` |
| PRs Merged        | `sum(ce_session_commits_total)`                                                                             |
| Avg Time-to-Merge | Derived from session duration (turns × avg turn time)                                                       |
| P1 Count          | Static annotation (from `todos/` review files)                                                              |

### Row 2 — Cost Efficiency (3 panels)

- **Cost per PR** (bar chart) — cost broken down by session
- **Cost by CE Phase** (pie chart) — tokens by phase label
- **Cost by Model** (pie chart) — tokens by model label (requires `model` label in metrics)

### Row 3 — Velocity (3 panels)

- **Time-to-Merge Trend** (time series) — session duration over time
- **Phase Duration Breakdown** (bar chart) — time spent per CE phase
- **Review Rounds per PR** (bar chart) — agent spawns per session

### Row 4 — Quality (3 panels)

- **Findings by Severity** (bar chart) — P1/P2/P3 counts from review events
- **P1 Rate Over Time** (time series) — P1 findings per session over time
- **Finding Rate per 1K LOC** (time series) — quality density trend

### Row 5 — Knowledge & Agents (3 panels)

- **Stale Todo Rate** (gauge) — % of todos resolved without code (triage-first metric)
- **Agent Respawn Rate** (gauge) — agent_complete without prior agent_spawn
- **Merge Conflict Streak** (stat) — consecutive sessions with 0 conflicts

### Row 6 — Active Session (3 stat panels, auto-refresh 15s)

| Panel                | Metric                                                   |
| -------------------- | -------------------------------------------------------- |
| Current Session Cost | `ce_session_tokens_total{session=~"$session"}` × price   |
| Current Phase        | `ce_session_tokens_total` phase label for latest session |
| Tokens This Session  | `sum(ce_session_tokens_total{session=~"$session"})`      |

---

## File Layout

```
scripts/ce-metrics/
├── hooks/                          # Canonical hook sources (version-controlled)
│   ├── lib.sh                      # Shared functions
│   ├── session-start.sh
│   ├── turn-complete.sh
│   ├── agent-spawn.sh
│   ├── agent-complete.sh
│   ├── git-event.sh
│   ├── task-complete.sh
│   └── session-end.sh
├── install-hooks.sh                # Copy hooks to ~/.claude/hooks/ce-metrics/ + patch settings.json
├── test-hooks.sh                   # Test harness (25 tests)
└── seed-test-data.sh               # Push synthetic data to Pushgateway

monitoring/
├── prometheus.yml                  # Scrape config (Pushgateway + self)
└── grafana/
    ├── provisioning/
    │   ├── datasources/            # Prometheus datasource auto-provisioning
    │   └── dashboards/             # Dashboard folder auto-provisioning
    └── dashboards/
        └── ce-metrics-main.json    # Main dashboard (19 panels)

~/.claude/
├── hooks/ce-metrics/               # Installed hooks (copied from scripts/ce-metrics/hooks/)
├── metrics/
│   ├── ce-events.jsonl             # Event log (rotates at 10MB → ce-events.jsonl.1)
│   ├── ce-phase.json               # Current session phase state
│   ├── pending/                    # Failed Pushgateway payloads (replayed automatically)
│   └── .disabled                  # Touch to disable all metrics collection
└── settings.json                   # Hook registrations (7 CE hooks + 3 existing hooks)
```

---

## Operations

### Updating Hooks

After editing any file in `scripts/ce-metrics/hooks/`:

```bash
bash scripts/ce-metrics/install-hooks.sh
```

The install script is idempotent — safe to run multiple times.

### Testing Hooks

```bash
bash scripts/ce-metrics/test-hooks.sh
# Expected: Passed: 25, Failed: 0
```

### Seeding Test Data

```bash
# Requires Pushgateway running
bash scripts/ce-metrics/seed-test-data.sh
```

Pushes 5 synthetic sessions (plan/work/review/compound/adhoc phases) to verify all dashboard panels render with data.

### Troubleshooting

**Hooks not firing**: Check `~/.claude/settings.json` has the 7 CE hook entries. Re-run `install-hooks.sh`.

**No data in Grafana**: Verify Pushgateway is reachable: `curl http://localhost:9091/metrics`. Check `~/.claude/metrics/pending/` for failed payloads.

**All events tagged `adhoc`**: The CE workflow skills (plan/work/review/compound) write `ce-phase.json` on invocation. If using `/workflows:plan` etc., verify the frontmatter hooks are present in the skill files.

**Grafana shows "No data"**: Prometheus scrapes Pushgateway every 15s. After pushing, wait up to 30s before data appears. Verify datasource at http://localhost:3002/connections/datasources.

---

## Security Notes

- `git-event.sh` reads only the first 30 characters of `tool_input.command` via `case` match — the full command is never stored or logged.
- `task-complete.sh` runs `sanitize_subject()` before emitting — strips `key=VALUE` patterns and 40+ char base64 strings from task subjects.
- Hooks never read `tool_result`, `message` content, or any user data — only numeric metadata and command prefixes.
- Pushgateway is bound to `127.0.0.1` (localhost only) in docker-compose.dev.yml.
