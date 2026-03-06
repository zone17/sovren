#!/usr/bin/env bash
# CE Flow Metrics — Collects the 4 Flow Framework metrics from GitHub
#
# Metrics:
#   flow_velocity     — PRs merged per week (rolling 4 weeks)
#   flow_efficiency   — Active work ratio (work phase / total PR time)
#   flow_time_hours   — End-to-end time from PR create to merge
#   flow_load         — Current open PRs (WIP)
#
# Usage: bash flow-metrics.sh [--once | --watch]
#   --once   Run once and exit (default)
#   --watch  Run every 5 minutes

set -euo pipefail

PUSHGATEWAY_URL="${PUSHGATEWAY_URL:-http://localhost:9091}"
REPO="${GITHUB_REPO:-zone17/sovren}"
PROJECT="Sovren"

# ── Helpers ──────────────────────────────────────────────────────────

push_metric() {
  local metric="$1" labels="$2" value="$3" help="${4:-}"
  local label_str=""
  [ -n "$labels" ] && label_str="{$labels}"

  local body=""
  [ -n "$help" ] && body="# HELP $metric $help\n# TYPE $metric gauge\n"
  body="${body}${metric}${label_str} ${value}"

  echo -e "$body" | curl -s --data-binary @- "${PUSHGATEWAY_URL}/metrics/job/ce_flow/project/${PROJECT}" 2>/dev/null
}

# ── Flow Load (simplest — current WIP) ──────────────────────────────

collect_flow_load() {
  local open_count
  open_count=$(gh pr list --repo "$REPO" --state open --json number --jq 'length' 2>/dev/null || echo "0")

  push_metric "flow_load" "project=\"$PROJECT\"" "$open_count" "Number of open PRs (work in progress)"
  echo "  Flow Load: $open_count open PRs"
}

# ── Flow Velocity + Flow Time (from merged PRs) ─────────────────────

collect_flow_velocity_and_time() {
  local pr_data
  pr_data=$(gh pr list --repo "$REPO" --state merged --json number,title,createdAt,mergedAt,headRefName,additions,deletions --limit 100 2>/dev/null)

  [ -z "$pr_data" ] && { echo "  WARNING: Could not fetch merged PRs"; return; }

  python3 << 'PYEOF' - "$pr_data" "$PUSHGATEWAY_URL" "$PROJECT"
import json, sys, urllib.request
from datetime import datetime, timedelta
from collections import defaultdict

pr_json, pushgw, project = sys.argv[1], sys.argv[2], sys.argv[3]
prs = json.loads(pr_json)

def push(metric, labels, value, help_text=""):
    label_str = "{" + labels + "}" if labels else ""
    body = ""
    if help_text:
        body += f"# HELP {metric} {help_text}\n# TYPE {metric} gauge\n"
    body += f"{metric}{label_str} {value}\n"
    req = urllib.request.Request(
        f"{pushgw}/metrics/job/ce_flow/project/{project}",
        data=body.encode(), method="POST",
        headers={"Content-Type": "text/plain"}
    )
    try:
        urllib.request.urlopen(req, timeout=5)
    except Exception:
        pass

now = datetime.now().astimezone()
four_weeks_ago = now - timedelta(weeks=4)

# ── Per-PR Flow Time ──
flow_times = []
for pr in prs:
    created = datetime.fromisoformat(pr["createdAt"].replace("Z", "+00:00"))
    merged = datetime.fromisoformat(pr["mergedAt"].replace("Z", "+00:00"))
    ft_hours = (merged - created).total_seconds() / 3600

    # Skip outliers (PRs open > 30 days are usually stale/abandoned then merged)
    if ft_hours > 720:
        continue

    flow_times.append(ft_hours)

    # Derive a clean slug from branch name
    branch = pr.get("headRefName", "unknown")
    slug = branch.split("/")[-1]
    # Strip ticket prefixes
    for prefix in ["SOV-", "S2-", "S3-", "S4-", "S5-", "S6-", "S7-"]:
        if slug.upper().startswith(prefix):
            slug = slug[len(prefix):]
    slug = slug[:40]

    labels = f'project="{project}",pr="{pr["number"]}",slug="{slug}"'
    push("flow_time_hours", labels, f"{ft_hours:.2f}", "Hours from PR create to merge")

    # Lines changed per PR
    added = pr.get("additions", 0)
    deleted = pr.get("deletions", 0)
    push("flow_lines_added", labels, str(added))
    push("flow_lines_deleted", labels, str(deleted))

# ── Weekly Velocity (rolling 4 weeks) ──
weekly = defaultdict(int)
for pr in prs:
    merged = datetime.fromisoformat(pr["mergedAt"].replace("Z", "+00:00"))
    if merged >= four_weeks_ago:
        week = merged.strftime("%Y-W%W")
        weekly[week] += 1

total_recent = sum(weekly.values())
weeks_counted = max(len(weekly), 1)
velocity = total_recent / weeks_counted

push("flow_velocity_prs_per_week", f'project="{project}"', f"{velocity:.1f}",
     "Average PRs merged per week (rolling 4 weeks)")
push("flow_velocity_total_4w", f'project="{project}"', str(total_recent),
     "Total PRs merged in last 4 weeks")

# Per-week breakdown
for week, count in sorted(weekly.items()):
    push("flow_velocity_weekly", f'project="{project}",week="{week}"', str(count))

# ── Flow Time Aggregates ──
if flow_times:
    sorted_ft = sorted(flow_times)
    median = sorted_ft[len(sorted_ft) // 2]
    avg = sum(flow_times) / len(flow_times)
    p90 = sorted_ft[int(len(sorted_ft) * 0.9)]

    push("flow_time_median_hours", f'project="{project}"', f"{median:.1f}",
         "Median flow time in hours")
    push("flow_time_avg_hours", f'project="{project}"', f"{avg:.1f}",
         "Average flow time in hours")
    push("flow_time_p90_hours", f'project="{project}"', f"{p90:.1f}",
         "90th percentile flow time in hours")

print(f"  Flow Velocity: {velocity:.1f} PRs/week ({total_recent} in last 4 weeks)")
print(f"  Flow Time: median={median:.1f}h, avg={avg:.1f}h, p90={p90:.1f}h ({len(flow_times)} PRs)")
for week in sorted(weekly.keys()):
    print(f"    {week}: {weekly[week]} PRs")
PYEOF
}

# ── Flow Efficiency (from CE phase data in transcripts) ──────────────

collect_flow_efficiency() {
  # Flow Efficiency = time in "work" phase / total session time
  # We compute this from ce-events.jsonl phase transitions
  local events_file="$HOME/.claude/metrics/ce-events.jsonl"

  if [ ! -f "$events_file" ]; then
    echo "  Flow Efficiency: no event data yet (will populate as workflows run)"
    return
  fi

  python3 << PYEOF - "$events_file" "$PUSHGATEWAY_URL" "$PROJECT"
import json, sys, urllib.request

events_file, pushgw, project = sys.argv[1], sys.argv[2], sys.argv[3]

def push(metric, labels, value, help_text=""):
    label_str = "{" + labels + "}" if labels else ""
    body = ""
    if help_text:
        body += f"# HELP {metric} {help_text}\n# TYPE {metric} gauge\n"
    body += f"{metric}{label_str} {value}\n"
    req = urllib.request.Request(
        f"{pushgw}/metrics/job/ce_flow/project/{project}",
        data=body.encode(), method="POST",
        headers={"Content-Type": "text/plain"}
    )
    try:
        urllib.request.urlopen(req, timeout=5)
    except Exception:
        pass

# Count phase transitions to estimate efficiency
phase_counts = {"plan": 0, "work": 0, "review": 0, "compound": 0, "brainstorm": 0, "adhoc": 0}
total_events = 0

with open(events_file) as f:
    for line in f:
        try:
            evt = json.loads(line.strip())
            phase = evt.get("phase", "adhoc")
            if phase in phase_counts:
                phase_counts[phase] += 1
            total_events += 1
        except (json.JSONDecodeError, KeyError):
            continue

if total_events == 0:
    print("  Flow Efficiency: no events yet")
    sys.exit(0)

# Efficiency = work events / total events (proxy for active work ratio)
work_events = phase_counts.get("work", 0)
efficiency = work_events / total_events if total_events > 0 else 0

push("flow_efficiency_ratio", f'project="{project}"', f"{efficiency:.3f}",
     "Ratio of active work to total activity (0-1)")

for phase, count in phase_counts.items():
    if count > 0:
        push("flow_phase_events", f'project="{project}",phase="{phase}"', str(count))

print(f"  Flow Efficiency: {efficiency:.1%} ({work_events} work / {total_events} total events)")
for phase, count in sorted(phase_counts.items()):
    if count > 0:
        print(f"    {phase}: {count}")
PYEOF
}

# ── Main ─────────────────────────────────────────────────────────────

run_once() {
  echo "CE Flow Metrics — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "================================================"
  echo ""
  collect_flow_load
  collect_flow_velocity_and_time
  collect_flow_efficiency
  echo ""
  echo "Done. Metrics pushed to $PUSHGATEWAY_URL"
}

case "${1:-}" in
  --watch)
    echo "Watching flow metrics every 5 minutes (Ctrl+C to stop)"
    while true; do
      run_once
      echo ""
      echo "Next update in 5 minutes..."
      sleep 300
    done
    ;;
  *)
    run_once
    ;;
esac
