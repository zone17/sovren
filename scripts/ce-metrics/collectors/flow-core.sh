#!/usr/bin/env bash
# CE Metrics — Flow Core Collector
# Collects: flow_load, flow_velocity, flow_time (moved from flow-metrics.sh)
# Requires: lib/github-api.sh, lib/pushgateway.sh sourced first

# ── Flow Load (current WIP) ────────────────────────────────────────

collect_flow_load() {
  local open_count
  open_count=$(gh pr list --repo "$REPO" --state open --json number --jq 'length' 2>/dev/null || echo "0")

  buffer_metric "flow_load" "project=\"$PROJECT\"" "$open_count" "Number of open PRs (work in progress)"
  echo "  Flow Load: $open_count open PRs"
}

# ── Flow Velocity + Flow Time (from merged PR data) ────────────────

collect_flow_velocity_and_time() {
  local pr_data="${1:-$PR_DATA}"
  [ -n "$pr_data" ] && [ "$pr_data" != "[]" ] || { echo "  WARNING: No PR data for velocity/time"; return; }

  # Write to temp file (avoids "Argument list too long" for large JSON)
  local tmp_pr
  tmp_pr=$(mktemp)
  echo "$pr_data" > "$tmp_pr"

  python3 << PYEOF
import json
from datetime import datetime, timedelta
from collections import defaultdict

project = "$PROJECT"

with open("$tmp_pr") as f:
    prs = json.load(f)

now = datetime.now().astimezone()
four_weeks_ago = now - timedelta(weeks=4)

metrics = []

def buf(metric, labels, value, help_text=""):
    metrics.append(f"METRIC:{metric}|{labels}|{value}|{help_text}")

# -- Per-PR Flow Time --
flow_times = []
for pr in prs:
    created = datetime.fromisoformat(pr["createdAt"].replace("Z", "+00:00"))
    merged = datetime.fromisoformat(pr["mergedAt"].replace("Z", "+00:00"))
    ft_hours = (merged - created).total_seconds() / 3600

    if ft_hours > 720:
        continue

    flow_times.append(ft_hours)

    branch = pr.get("headRefName", "unknown")
    slug = branch.split("/")[-1]
    for prefix in ["SOV-", "S2-", "S3-", "S4-", "S5-", "S6-", "S7-"]:
        if slug.upper().startswith(prefix):
            slug = slug[len(prefix):]
    slug = slug[:40]

    labels = f'project="{project}",pr="{pr["number"]}",slug="{slug}"'
    buf("flow_time_hours", labels, f"{ft_hours:.2f}", "Hours from PR create to merge")

    added = pr.get("additions", 0)
    deleted = pr.get("deletions", 0)
    buf("flow_lines_added", labels, str(added))
    buf("flow_lines_deleted", labels, str(deleted))

# -- Weekly Velocity (rolling 4 weeks) --
weekly = defaultdict(int)
for pr in prs:
    merged = datetime.fromisoformat(pr["mergedAt"].replace("Z", "+00:00"))
    if merged >= four_weeks_ago:
        week = merged.strftime("%Y-W%W")
        weekly[week] += 1

total_recent = sum(weekly.values())
weeks_counted = max(len(weekly), 1)
velocity = total_recent / weeks_counted

buf("flow_velocity_prs_per_week", f'project="{project}"', f"{velocity:.1f}",
    "Average PRs merged per week (rolling 4 weeks)")
buf("flow_velocity_total_4w", f'project="{project}"', str(total_recent),
    "Total PRs merged in last 4 weeks")

for week, count in sorted(weekly.items()):
    buf("flow_velocity_weekly", f'project="{project}",week="{week}"', str(count))

# -- Flow Time Aggregates --
if flow_times:
    sorted_ft = sorted(flow_times)
    median = sorted_ft[len(sorted_ft) // 2]
    avg = sum(flow_times) / len(flow_times)
    p90 = sorted_ft[int(len(sorted_ft) * 0.9)]

    buf("flow_time_median_hours", f'project="{project}"', f"{median:.1f}",
        "Median flow time in hours")
    buf("flow_time_avg_hours", f'project="{project}"', f"{avg:.1f}",
        "Average flow time in hours")
    buf("flow_time_p90_hours", f'project="{project}"', f"{p90:.1f}",
        "90th percentile flow time in hours")

    print(f"  Flow Velocity: {velocity:.1f} PRs/week ({total_recent} in last 4 weeks)")
    print(f"  Flow Time: median={median:.1f}h, avg={avg:.1f}h, p90={p90:.1f}h ({len(flow_times)} PRs)")
else:
    print(f"  Flow Velocity: {velocity:.1f} PRs/week ({total_recent} in last 4 weeks)")
    print("  Flow Time: no data yet")

for m in metrics:
    print(m)
PYEOF

  rm -f "$tmp_pr"
}
