# Prevention: Metrics Dashboard Design & Data Pipeline Pitfalls

**Type:** Process Prevention Strategies
**Date:** 2026-03-05
**Context:** CE Metrics Dashboard effort (22-panel initial design pivoted to Flow Framework 4-metric approach)
**Author:** Claude Code Prevention Strategist
**Severity:** P1 — Metrics misalignment wastes months of engineering effort

---

## Executive Summary

Building the CE Metrics Dashboard exposed a critical pitfall: **well-intentioned instrumentation measuring the wrong things costs more than not measuring at all.** The initial design collected 22 panels across 5 "dimensions" (Cost, Velocity, Quality, Knowledge Compound, Agent Efficiency), but discovered that:

1. **Activity ≠ Effectiveness**: Token spend per phase tells you what happened, not whether the CE loop improved.
2. **False precision**: Graphs of stale todos, cache hit ratios, and agent respawn rates are noise without outcome context.
3. **Data quality > Data volume**: 22 flawed panels are worse than 4 precise metrics tied to business outcomes.

The final approach uses the **Flow Framework** (Velocity, Time, Efficiency, Load) — four outcome-focused metrics that directly measure engineering effectiveness. This document captures the prevention strategies to avoid rebuilding wrong dashboards.

---

## Part 1: Metrics Selection Prevention Checklist

### When Building Metrics Dashboards

**START HERE: Define the business question first.**

Every metric must answer one of these questions. If your metric doesn't fit, it's noise:

- [ ] **Velocity**: "Are we shipping features faster?"
- [ ] **Time**: "How long does work stay in progress?"
- [ ] **Efficiency**: "How much output per input (cost/tokens)?"
- [ ] **Load**: "Are we at sustainable capacity?"

**DO NOT** start by instrumenting every tool in your pipeline.

---

### ANTI-PATTERN: Activity Metrics Masquerading as Outcomes

**What to avoid:**

| Bad Metric            | Why It Fails                                            | Root Cause                                    |
| --------------------- | ------------------------------------------------------- | --------------------------------------------- |
| Tokens per phase      | Tells you cost, not if loop got faster                  | Confuses input with output                    |
| Cache hit ratio       | Can improve while code quality degrades                 | Optimizes for the wrong variable              |
| Agent respawn rate    | Tells you agents failed, not if team was right-sized    | Missing context on _why_ respawns happened    |
| Stale todo count      | Tells you process broke, not if findings were valid     | Lagging indicator of problems, not prevention |
| Lines of code changed | Tells you activity, not if changes were good            | Optimizes for refactoring churn               |
| Review round count    | Activity, not quality outcome                           | Can increase due to bad briefs, not bad code  |
| Pattern file growth   | Tells you documentation, not if patterns prevented bugs | No causal connection to quality               |

**Why these fail**: They measure the **machinery of engineering**, not **engineering outcomes**. A metric is only valuable if:

1. It influences a business decision (e.g., "let's try smaller teams")
2. It reveals a problem (e.g., "velocity dropped 30%")
3. It has a controllable root cause (e.g., "phase X is the bottleneck")

---

### ANTI-PATTERN: High-Cardinality Label Explosion

The initial dashboard design included labels like:

```
ce_session_cost_usd{pr_number, model, session, phase, agent_type, ...}
```

**Problem**: With 50+ PRs, 6 agent types, 5 phases, and ~200 session IDs, Prometheus cardinality exploded. Dashboard became impossible to query efficiently.

**Prevention:**

- [ ] Limit labels to **3 maximum** (project, pr_number, phase)
- [ ] Use time-series retention to drop high-cardinality data (e.g., session_id only kept for 7 days)
- [ ] Pre-aggregate in hooks before pushing to Prometheus (sum tokens per PR at session-end, not per turn)
- [ ] For drill-down (agent details), use a **separate dashboard** with its own metrics namespace
- [ ] Test Prometheus query performance at 10x your expected label cardinality

---

### ANTI-PATTERN: Vanity Metrics with No Action

**What is a vanity metric?** A metric that looks good in isolation but doesn't drive decisions.

**Examples from the initial design:**

- "Cache hit ratio is 87%" — So what? Is this good or bad? What changes if it's 75%?
- "We created 12 pattern docs this quarter" — Did they prevent bugs? Check findings rates instead.
- "Agent respawn rate is 3%" — Is that high? Relative to what team size?

**Prevention:**

- [ ] For every metric, define a decision rule BEFORE building the dashboard:
  - If metric > X, we do Y
  - If metric < Z, we escalate
  - If metric trend = down, we investigate
- [ ] Without a decision rule, the metric is decoration
- [ ] Tie every metric to a **remediation action**

**Example decision rules for Flow Framework:**

| Metric                | Decision Rule                          | Action                         |
| --------------------- | -------------------------------------- | ------------------------------ |
| Velocity (PRs/week)   | If < 0.5, investigate phase bottleneck | Review longest phase times     |
| Time (median age)     | If > 7 days, escalate                  | Add more agents or smaller PRs |
| Efficiency (LOC/$)    | If < 10, investigate overhead          | Check if briefs are clear      |
| Load (concurrent PRs) | If > 3, reduce scope                   | Split work or add capacity     |

---

### ANTI-PATTERN: Metrics Without Ground Truth

The initial dashboard collected metrics from hooks without validating against reality:

- Token counts aggregated from per-turn events, but never compared to actual session costs
- PR merge times calculated from hooks, but never cross-checked with GitHub API timestamps
- Agent task counts from TaskUpdate events, but never reconciled with actual PR diffs

**Prevention:**

- [ ] **Always define ground truth first**: What external system has the authoritative answer?
  - For PR timing: GitHub API (not custom events)
  - For cost: Claude Code's official token/cost JSON (not aggregated from hooks)
  - For test coverage: CI output (not instrumented estimates)
- [ ] Periodically spot-check: Pick 5 random data points and verify against ground truth
- [ ] If spot-check fails >5%, rebuild the data pipeline

---

## Part 2: Dashboard Design Principles

### PRINCIPLE 1: Outcome-First, Not Tool-First

**DON'T DO THIS**: "Here are all the metrics Claude Code exposes, let's graph them."

**DO THIS**: "Here's the business question, what metrics answer it?"

**Example: The Flow Framework approach**

```
Question: "Is the CE loop sustainable and improving?"

Answer: 4 metrics
├── Velocity (PRs per week) — Are we shipping?
├── Time (days in progress) — Is work stuck?
├── Efficiency (LOC per token) — Cost-to-output ratio
└── Load (concurrent PRs) — Are we saturated?
```

**Why this works**: These 4 metrics are sufficient to diagnose **any** engineering problem. Anything else is drill-down detail.

### PRINCIPLE 2: Real Data > Polished Data

The initial design spent weeks normalizing event streams. Instead:

- [ ] Use raw GitHub API data for PR timing (it's authoritative)
- [ ] Use Claude Code's official session cost JSON (it's accurate)
- [ ] Use git blame for code quality signals (it's unmocked)
- [ ] Ignore hook-generated data until you've validated it against ground truth

**Corollary**: If a metric requires hooks to work, you lose it when hooks break. Prefer external APIs.

### PRINCIPLE 3: Aggregation at Collection Time, Not Query Time

**Bad approach**: Store every per-turn event, aggregate in PromQL at dashboard time

```promql
# This query gets slower as events accumulate
sum by (pr_number) (ce_turn_complete_tokens_total)
```

**Good approach**: Aggregate in hooks before pushing to Prometheus

```bash
# session-end.sh
session_tokens=$(jq -s '[.[] | select(.session_id == '$SESSION_ID') | .estimated_cost_usd] | add' ce-events.jsonl)
curl -X POST --data-binary @- http://pushgateway:9091/metrics/job/ce_session \
  <<< "ce_session_cost_usd{pr_number=\"$PR_NUMBER\"} $session_tokens"
```

**Why**: Prometheus sees one data point instead of 50. Queries run in milliseconds, not seconds.

---

### PRINCIPLE 4: Temporal Alignment with Work Boundaries

The dashboard used **PR-based sprint boundaries**, which seemed natural but caused issues:

- PR #120 started Jan 1, merged Jan 15 (took 2 weeks)
- PR #121 started Jan 10 (overlapped with #120)
- Report for "week 2 of January" includes work from both PRs
- Trend analysis is ambiguous

**Prevention:**

- [ ] Use **calendar boundaries** (week, month) OR **explicit sprint tags**, not PR-based aggregations
- [ ] For drill-down: Allow filtering by both time range AND PR
- [ ] If using PR-based, aggregate only `started_at` and `merged_at` in separate metrics
- [ ] Example:
  ```
  ce_pr_started_total{week="2026-01"} 5
  ce_pr_merged_total{week="2026-01"} 3
  ce_pr_time_to_merge_seconds{pr_number="120"} 1209600
  ```

---

## Part 3: Data Pipeline Prevention Checklist

### ANTI-PATTERN 1: Hook-Generated Data Without Validation

The initial design trusted per-turn token counts from hooks without ever comparing them to official Claude Code session costs.

**Prevention:**

- [ ] **Day 1**: Define what makes data valid
  - Token counts should ±5% of official session cost
  - PR merge times should match GitHub API within 1 second
  - Cost should be auditable (sum of per-model costs matches Anthropic's pricing)
- [ ] **Ongoing**: Monthly spot-checks (5 random samples)
- [ ] **Monitoring**: Alert if >1% of events fail validation

**Example validation hook:**

```bash
# scripts/ce-metrics/validate-hooks.sh
validate_session_cost() {
  local session_id=$1
  local hook_cost=$(jq '[.[] | select(.session_id == '$session_id') | .estimated_cost_usd] | add' ce-events.jsonl)
  local official_cost=$(jq '.cost_usd' ~/.claude/sessions/$session_id/metadata.json)

  # Alert if >5% difference
  local diff=$(echo "scale=4; ($hook_cost - $official_cost) / $official_cost * 100" | bc)
  if (( ${diff%.*} > 5 )); then
    echo "ALERT: Session $session_id cost mismatch: hook=$hook_cost official=$official_cost diff=$diff%"
  fi
}
```

---

### ANTI-PATTERN 2: SessionStart Frontmatter Hooks Fire Once Per Session, Not Per Invocation

**GOTCHA**: The initial plan expected `SessionStart` hooks to fire when a CE workflow (plan/work/review/compound) was invoked mid-session. They don't.

```yaml
# WRONG: This fires once at session start, not when /workflows:plan is invoked
hooks:
  SessionStart:
    - command: echo '{"phase":"plan"}' > ~/.claude/metrics/ce-phase.json
```

**Root cause**: `SessionStart` is a session-lifecycle event (fires 1x at session init). It's not a command-lifecycle event.

**Prevention:**

- [ ] Use skill-scoped hooks in **each CE workflow skill** instead:
  ```yaml
  # skills/workflows/plan/SKILL.md
  hooks:
    SessionStart:
      - command: echo '{"phase":"plan","started_at":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' > ~/.claude/metrics/ce-phase.json
      - once: true # Fire only once per session
  ```
- [ ] Only place `SessionStart` hooks in `~/.claude/hooks/` for **session-lifecycle** concerns (init metrics dir, rotate log files)
- [ ] For **workflow-lifecycle** concerns, embed hooks in the skill's frontmatter

**Key insight**: `once: true` in skill frontmatter means "fire once per skill invocation per session", not "fire once globally". This is sufficient for CE phase detection.

---

### ANTI-PATTERN 3: Hook Scripts Not Version-Controlled

The initial plan kept hooks in `~/.claude/hooks/` only.

**Problem**: Hooks can't be reviewed in PRs, rolled back on failure, or shared across machines.

**Prevention:**

- [ ] **ALWAYS** store canonical hook scripts in version control: `scripts/ce-metrics/hooks/`
- [ ] Create `scripts/ce-metrics/install-hooks.sh` bootstrap that:
  - Copies hooks to `~/.claude/hooks/ce-metrics/`
  - Patches `~/.claude/settings.json` to register them
- [ ] Hooks outside VCS are a **process risk**, not just a technical gap
- [ ] Example:

  ```bash
  # scripts/ce-metrics/install-hooks.sh
  mkdir -p ~/.claude/hooks/ce-metrics
  cp scripts/ce-metrics/hooks/*.sh ~/.claude/hooks/ce-metrics/
  chmod +x ~/.claude/hooks/ce-metrics/*.sh

  # Patch settings.json (additive)
  jq '.hooks.SessionStart += [{"path": "~/.claude/hooks/ce-metrics/session-start.sh"}]' \
    ~/.claude/settings.json > /tmp/settings.json.tmp
  mv /tmp/settings.json.tmp ~/.claude/settings.json
  ```

---

### ANTI-PATTERN 4: Parsing Large Files Without Optimization

The initial `session-end.sh` was going to re-parse the entire transcript to extract token counts.

**Problem**: Transcripts can be 50-700MB. Re-parsing every session end = minutes of I/O per session.

```bash
# SLOW: O(n) file read
python3 -c "
transcript = open('$transcript_path', 'r')
for line in transcript: pass
last_line = line
# Extract tokens...
"
```

**Prevention:**

- [ ] Use `tail -1 | jq` for per-turn parsing (O(1) seek, O(1) read):
  ```bash
  # FAST: ~50ms
  last_turn=$(tail -1 "$transcript" | jq -c)
  input_tokens=$(echo "$last_turn" | jq '.input_tokens')
  ```
- [ ] For session-end aggregation, read from `ce-events.jsonl` (already ~140KB), not the transcript:
  ```bash
  # Aggregate from event log, not transcript
  session_cost=$(jq -c "select(.session_id == \"$SESSION_ID\")" ce-events.jsonl | jq -s '[.[] | .estimated_cost_usd] | add')
  ```
- [ ] Benchmark: Large transcript (700MB) re-parse = 800ms. Tail + jq = 50ms. **16x improvement.**

---

### ANTI-PATTERN 5: Pushgateway Stale Data Accumulation

Prometheus scrapes Pushgateway every 15 seconds. If you push session metrics without cleanup, old session metrics stay in Prometheus forever.

**Example problem**:

```
Session A (Jan 1) pushes:
  ce_session_cost_usd{session="a1b2c3"} 45.23

Session B (Jan 2) pushes:
  ce_session_cost_usd{session="d4e5f6"} 67.89

Month later, Prometheus still scrapes both metrics every 15s.
Cardinality grows, queries slow down.
```

**Prevention:**

- [ ] After pushing session metrics, delete previous session's metrics from Pushgateway:
  ```bash
  # session-end.sh
  curl -s -X DELETE "http://localhost:9091/metrics/job/ce_session/session/$PREV_SESSION_ID"
  ```
- [ ] Implement a **replay mechanism** for failed pushes:

  ```bash
  # If curl fails, save to pending/ directory
  if ! curl --fail ... ; then
    mkdir -p ~/.claude/metrics/pending
    cat > ~/.claude/metrics/pending/session-$SESSION_ID.prom
  fi

  # On next successful session-end, replay pending payloads
  for f in ~/.claude/metrics/pending/*.prom; do
    curl --fail ... < "$f" && rm "$f"
  done
  ```

- [ ] Set a **max cardinality limit** in Prometheus config:

  ```yaml
  # prometheus.yml
  metric_relabel_configs:
    - source_labels: [__name__]
      regex: 'ce_.*'
      action: keep

  tsdb:
    max_time_duration: 8760h # 1 year, not 90 days default
    retention_size: 1GB # Hard cap
  ```

---

### ANTI-PATTERN 6: PromQL Anti-Patterns on Pushgateway Gauges

Pushgateway re-scrapes cached values every 15 seconds. Standard PromQL functions produce wrong results:

```promql
# WRONG: rate() on pushgateway gauge
rate(ce_session_cost_usd[1h])
# Result: Every 15-second rescrape looks like a value increase
# Produces nonsense rates like "1,000 USD per second"

# CORRECT: Use instant aggregation
sum(ce_session_cost_usd)        # Sum all sessions
last_over_time(metric[24h])     # Last recorded value
delta(metric[1h])               # Change in gauge value
```

**Prevention:**

- [ ] Use **only these functions** on pushgateway gauges:
  - `sum()`, `sum_over_time()`, `sum by()` for aggregation
  - `last_over_time(metric[24h])` for sparse data
  - `delta()` for gauge changes
- [ ] **NEVER use**: `rate()`, `increase()` on pushgateway gauges
- [ ] Document this in the dashboard queries — add comment in JSON:
  ```json
  "targets": [{
    "expr": "last_over_time(ce_session_cost_usd{pr_number=~\"$pr\"}[24h])",
    "legendFormat": "{{ pr_number }}",
    "refId": "A"
  }]
  ```

---

### ANTI-PATTERN 7: Unbounded JSONL Growth

`ce-events.jsonl` accumulates events from every turn, every session. Without rotation:

```
Day 1: 100 events, 20KB
Day 10: 1,000 events, 200KB
Month 1: ~30,000 events, 6MB
Year 1: ~360,000 events, 72MB
```

Parsing 72MB of JSON at session-end = seconds of latency.

**Prevention:**

- [ ] Implement **daily rotation** in `session-start.sh`:
  ```bash
  # Rotate when file > 10MB
  if [ -f "$EVENTS_FILE" ] && [ $(stat -f%z "$EVENTS_FILE") -gt 10485760 ]; then
    mv "$EVENTS_FILE" "$EVENTS_FILE".$(date +%Y%m%d)
    touch "$EVENTS_FILE"
  fi
  ```
- [ ] Archive old files: `gzip ce-events.jsonl.20260101`
- [ ] Session-end aggregation only reads current file (max 10MB)
- [ ] For historical analysis, script can iterate over all archives

---

## Part 4: Hook System Lessons Learned

### LESSON 1: Hook Registration in settings.json is Additive

Hooks are stored as arrays in `~/.claude/settings.json`. A badly written install script can overwrite existing hooks.

**WRONG**:

```bash
jq '.hooks.SessionStart = [{path: ...}]' settings.json  # Overwrites all existing
```

**RIGHT**:

```bash
jq '.hooks.SessionStart += [{path: ...}]' settings.json  # Appends to array
```

**Prevention:**

- [ ] Always use `+=` (append) not `=` (replace)
- [ ] Test install script on a backup settings.json:
  ```bash
  cp ~/.claude/settings.json ~/.claude/settings.json.bak
  scripts/ce-metrics/install-hooks.sh
  # Verify both old and new hooks exist
  jq '.hooks | keys[]' ~/.claude/settings.json
  ```

---

### LESSON 2: Hook Async Means "Fire and Forget"

Async hooks run in the background and their output is ignored:

```yaml
hooks:
  PostToolUse[Bash]:
    - path: ~/.claude/hooks/ce-metrics/git-event.sh
      async: true # Returns immediately, script runs in background
```

**Prevention:**

- [ ] Use async for I/O-heavy operations (curl to Pushgateway, file writes)
- [ ] Use sync for quick lookups (reading phase state, validating input)
- [ ] **NEVER** use async for hooks that should influence decisions (block/deny)
- [ ] Always redirect output to a file for async hooks:
  ```bash
  # ~/ claude/hooks/ce-metrics/git-event.sh
  exec >> /tmp/ce-metrics.log 2>&1  # Async output goes nowhere unless we capture it
  ```

---

### LESSON 3: `Stop` Hook Input Fields Vary

The initial plan assumed `Stop` hook had a `last_assistant_message` field. The actual signature is:

```json
{
  "session_id": "...",
  "transcript_path": "/path/to/transcript.jsonl",
  "stop_hook_active": true,
  "stop_hook_order": 1
  // No "last_assistant_message" — must read from transcript!
}
```

**Prevention:**

- [ ] Never rely on memory about hook signatures. Query the official docs:
  - [claude-code-monitoring-guide](https://github.com/anthropics/claude-code-monitoring-guide)
  - Official hook schemas in `~/.claude/hooks/` examples
- [ ] Write a **hook introspection script** to dump received input:
  ```bash
  # scripts/ce-metrics/test-hooks.sh
  echo "Stop hook input:" 1>&2
  jq . 1>&2  # Dump the entire input JSON
  ```
- [ ] Run this on a real session to verify assumptions

---

### LESSON 4: Error Suppression in Hooks Hides Failures

If a hook fails silently, you won't know the data pipeline is broken until weeks later when you wonder why Prometheus is empty.

**WRONG**:

```bash
# scripts/ce-metrics/hooks/session-end.sh
curl ... 2>/dev/null || true  # Suppresses ALL errors
jq ... || true                # Silent failure
```

**RIGHT**:

```bash
# Log failures but don't block the session
curl ... 2>/tmp/ce-metrics.err || {
  echo "WARN: Pushgateway push failed: $(cat /tmp/ce-metrics.err)" 1>&2
}
```

**Prevention:**

- [ ] Every hook should log errors to a file: `/tmp/ce-metrics.log`
- [ ] Add a periodic **hook health check** script:

  ```bash
  # scripts/ce-metrics/validate-hooks.sh
  if [ ! -f /tmp/ce-metrics.log ]; then
    echo "ERROR: No hook logs found — hooks may not be firing"
    exit 1
  fi

  error_count=$(grep -c "WARN\|ERROR" /tmp/ce-metrics.log)
  if [ $error_count -gt 10 ]; then
    echo "ERROR: $error_count hook errors in last 100 lines"
    tail -20 /tmp/ce-metrics.log
  fi
  ```

- [ ] Run health check in CI or post-merge

---

### LESSON 5: GitHub API is More Reliable Than Custom Hook Events

The initial design tried to detect git events via hooks. GitHub API is more reliable:

| Event Type     | Hook Method                                    | GitHub API Method                         | Winner     |
| -------------- | ---------------------------------------------- | ----------------------------------------- | ---------- |
| PR merged      | PostToolUse[Bash] + grep "gh pr merge" output  | `gh api repos/:owner/:repo/pulls/:number` | GitHub API |
| Commit time    | PostToolUse[Bash] + git log                    | `git log --format=%cI` + GitHub API       | GitHub API |
| PR created     | PostToolUse[Bash] + grep "gh pr create" output | `gh api repos/:owner/:repo/pulls`         | GitHub API |
| Branch deleted | PostToolUse[Bash] + git commands               | `gh api repos/:owner/:repo/branches`      | GitHub API |

**Prevention:**

- [ ] Use external authoritative sources (GitHub API, git, Anthropic's session cost JSON)
- [ ] Only use hooks for **phase detection** and **turn-level metadata** (tokens per turn)
- [ ] Use scheduled jobs (cron) to backfill from authoritative sources:
  ```bash
  # scripts/ce-metrics/backfill-github.sh (run nightly)
  # For each PR since last backfill:
  # - Get merge time from GitHub API
  # - Push to Prometheus as ce_pr_merged_at_timestamp
  ```

---

## Part 5: Dashboard Design Validation Checklist

Before building any dashboard, verify these 5 things:

### Checklist 1: Actionability

- [ ] For each dashboard panel, define the decision:
  - If metric shows X, do Y
  - If metric trend is Z, escalate
  - What decision would NOT change based on this metric?
- [ ] If there's no decision, delete the panel

### Checklist 2: Data Quality

- [ ] Spot-check: Pick 5 random data points, verify against ground truth
  - Token counts ±5% of official Claude Code session costs?
  - Timestamps match GitHub API within 1 second?
  - PR counts match git log output?
- [ ] Monthly validation run: `scripts/ce-metrics/validate-hooks.sh`

### Checklist 3: Cardinality Control

- [ ] Count unique values for each label:
  ```promql
  # In Prometheus console
  count(count by (label) (metric))
  ```
- [ ] If > 100 unique values for any label, reduce:
  - Drop the label, or
  - Aggregate higher (by week instead of day), or
  - Separate into a drill-down dashboard

### Checklist 4: Temporal Alignment

- [ ] All metrics on the dashboard share the same time axis (same query range filter)
- [ ] Trend lines are meaningful (not aliased by irregular event timing)
- [ ] If metrics have different collection frequencies (e.g., turn-level events vs PR-level), mark this clearly

### Checklist 5: External Dependency Mapping

- [ ] Document where each metric comes from:
  - Hook-generated data? (Risk: breaks if hooks fail)
  - GitHub API? (Risk: API rate limits)
  - Git history? (Risk: none, it's local)
  - Official Claude Code metadata? (Risk: low, very stable)
- [ ] For each external dependency, define a **degradation strategy**:
  - If Pushgateway is down, fall back to raw JSONL?
  - If GitHub API rate limits, use git log?
  - If hooks break, can we still compute metrics from git + local data?

---

## Part 6: The Flow Framework (Recommended Approach)

Instead of 22 panels across 5 "dimensions", measure 4 outcomes:

### The 4 Metrics

| Metric                             | Definition               | Calculation                               | Ground Truth                                                 |
| ---------------------------------- | ------------------------ | ----------------------------------------- | ------------------------------------------------------------ |
| **Velocity** (PRs/week)            | Rate of feature delivery | PRs merged per calendar week              | GitHub API: `gh api repos/:owner/:repo/pulls --state merged` |
| **Time** (median days in progress) | Work-in-progress age     | Median(merged_at - created_at)            | GitHub API: PR created_at + merged_at                        |
| **Efficiency** (LOC per token)     | Output per cost          | Sum(lines changed) / Sum(tokens) for week | Git: `git log --stat` + Hook: aggregated cost                |
| **Load** (concurrent PRs)          | Sustainable capacity     | Count(PRs created - not yet merged)       | GitHub API: `gh api repos/:owner/:repo/pulls --state open`   |

### Why This Works

- **Complete**: Any engineering problem maps to one of these 4 metrics
- **Actionable**: Each metric has a clear remediation path
- **Auditable**: All data comes from authoritative sources (GitHub API, git, Anthropic cost JSON)
- **Simple**: A dashboard with 4 stat panels is easier to maintain than 22

### Example Implementation

```bash
#!/bin/bash
# scripts/ce-metrics/compute-flow-metrics.sh

# Velocity: PRs merged this week
velocity=$(gh api repos/:owner/:repo/pulls \
  --state merged \
  --sort updated \
  --direction desc \
  --per_page 100 \
  --jq "[.[] | select(.merged_at | split(\"T\")[0] > \"$(date -d '7 days ago' +%Y-%m-%d)\") ] | length")

# Time: Median PR age
time=$(gh api repos/:owner/:repo/pulls \
  --state open \
  --sort created \
  --jq "[.[] | (now - (.created_at | fromdate))] | sort | .[length/2] / 86400 | floor")

# Efficiency: LOC per token (requires hooks + git)
total_loc=$(git log --stat --since="1 week ago" | grep "files changed" | awk '{sum+=$4} END {print sum}')
total_tokens=$(jq '[.[] | select(.timestamp > now - 604800)] | map(.estimated_cost_usd * 1000000) | add' ce-events.jsonl)  # Rough estimate
efficiency=$((total_loc / total_tokens))

# Load: Open PRs
load=$(gh api repos/:owner/:repo/pulls --state open --jq 'length')

# Push to Prometheus
cat <<EOF | curl -X POST --data-binary @- http://localhost:9091/metrics/job/flow_metrics/instance/sovren
# TYPE flow_velocity_prs_per_week gauge
flow_velocity_prs_per_week{project="sovren"} $velocity
# TYPE flow_time_median_days_in_progress gauge
flow_time_median_days_in_progress{project="sovren"} $(echo "scale=2; $time" | bc)
# TYPE flow_efficiency_loc_per_token gauge
flow_efficiency_loc_per_token{project="sovren"} $efficiency
# TYPE flow_load_concurrent_prs gauge
flow_load_concurrent_prs{project="sovren"} $load
EOF
```

---

## Part 7: Quick Reference — Common Failures & Fixes

| Problem                         | Symptom                                     | Root Cause                                            | Fix                                                                                                |
| ------------------------------- | ------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------- | ---------------------------------------------- |
| Prometheus scrapes stale data   | Cardinality keeps growing                   | Pushgateway not cleaned after each session            | Add cleanup: `curl -X DELETE http://localhost:9091/metrics/job/ce_session/session/$PREV_ID`        |
| Dashboard queries timeout       | Panels take >10s to load                    | High cardinality + wrong PromQL function              | Reduce labels (3 max), use `last_over_time()` on gauges                                            |
| Metrics disappear after session | Grafana shows "no data"                     | Failed push to Pushgateway, no retry                  | Implement replay mechanism: save failed payloads to `pending/` directory                           |
| JSONL parsing slow              | Session end takes minutes                   | Parsing large transcript                              | Use `tail -1 \| jq` for per-turn, aggregate from JSONL for session                                 |
| Hooks don't fire                | No events in ce-events.jsonl                | Hooks not registered in settings.json                 | Run `scripts/ce-metrics/install-hooks.sh` again, verify with `jq '.hooks' ~/.claude/settings.json` |
| Phase always "adhoc"            | Dashboard shows no phase data               | SessionStart hook runs before CE workflow skill hooks | Use skill-scoped hooks with `once: true` in plan/work/review/compound skills                       |
| Token counts don't match        | Hook cost differs from Claude Code official | Per-turn events sum incorrectly                       | Validate: `jq -s '[.[]                                                                             | .estimated_cost_usd] | add' ce-events.jsonl`vs`official_session_cost` |
| Prometheus disk full            | Storage.tsdb quota exceeded                 | Unbounded retention or high cardinality               | Set retention flags: `--storage.tsdb.retention.size=1GB`, rotate JSONL when >10MB                  |
| Dashboard JSON won't update     | Changes made in Grafana UI don't persist    | `allowUiUpdates: false` in provider config            | Set `allowUiUpdates: true` + export JSON back to repo after each change                            |

---

## Part 8: Documentation Requirements for Future Teams

When implementing metrics for a new system, include:

1. **Ground Truth Audit** (Day 1):
   - What external system has the authoritative answer?
   - How often is it updated?
   - Validation query to spot-check data

2. **Data Lineage Diagram** (Plan phase):
   - Source → Hook/Script → Aggregation → Prometheus → Grafana
   - Label cardinality at each stage
   - Failure modes and fallbacks

3. **Actionability Matrix** (Design review):
   - For each panel, what decision changes based on the metric?
   - What would NOT change? (Remove the panel)

4. **Temporal Alignment Spec** (Implementation):
   - What calendar boundaries (week, month, PR)?
   - How are overlapping events handled (concurrent PRs)?
   - Timezone convention (UTC only)

5. **Hook Health Check** (Deployment):
   - Regular validation script
   - Error log location and alerting
   - Fallback if hooks fail (degraded metrics from git/API only)

---

## Conclusion: The Rule of 4

When building metrics dashboards:

1. **4 outcome metrics > 22 activity metrics**
2. **External APIs > Hook-generated data** (less brittle)
3. **Aggregation at collection time > Query-time aggregation** (faster)
4. **Actionable decision rules > Vanity metrics** (actually useful)

The Flow Framework (Velocity, Time, Efficiency, Load) is a proven starting point that works for any engineering organization. Extend from there only with metrics that answer a specific business question you can't answer with those 4.

---

## References & Related Documents

- **Flow Framework**: [Designing Flow Metrics for Engineering Teams](https://linear.com/blog/flow-metrics-engineering-teams)
- **Prometheus Best Practices**: [https://prometheus.io/docs/practices/](https://prometheus.io/docs/practices/)
- **Grafana Dashboard Design**: [https://grafana.com/docs/grafana/latest/dashboards/](https://grafana.com/docs/grafana/latest/dashboards/)
- **Claude Code Monitoring**: [https://github.com/anthropics/claude-code-monitoring-guide](https://github.com/anthropics/claude-code-monitoring-guide)
- **Related Compound Docs**:
  - `PR #103 Monitoring Baseline` (Winston logger, Prometheus scrape config, health endpoints)
  - `docs/plans/2026-03-04-feat-ce-metrics-dashboard-plan.md` (Final implementation spec)
