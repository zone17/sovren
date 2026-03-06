#!/usr/bin/env bash
# CE Metrics — Agent Pipeline + Flow Efficiency Collector
# Single-pass JSONL parser: extracts agent cycle times, phase counts, guardrail blocks
# Requires: lib/pushgateway.sh sourced first

collect_agent_and_phase_metrics() {
  local events_file="$HOME/.claude/metrics/ce-events.jsonl"

  if [ ! -f "$events_file" ]; then
    echo "  Agent/Phase metrics: no event data yet"
    return
  fi

  # Single-pass Python parser — reads JSONL once, extracts everything
  local output
  output=$(python3 << 'PYEOF' - "$events_file" "$PROJECT"
import json, sys
from collections import defaultdict

events_file, project = sys.argv[1], sys.argv[2]

valid_phases = {"plan", "work", "review", "compound", "brainstorm", "adhoc"}

agent_durations = defaultdict(list)  # agent_type -> [seconds]
phase_counts = defaultdict(int)       # phase -> count
guardrail_blocks = defaultdict(int)   # hook:rule -> count
total_events = 0

with open(events_file) as f:
    for line in f:
        try:
            evt = json.loads(line.strip())
        except (json.JSONDecodeError, ValueError):
            continue

        t = evt.get("type")

        if t == "agent_complete":
            dur = evt.get("duration_seconds", 0)
            atype = evt.get("agent_type", "unknown")
            if dur and dur > 0:
                agent_durations[atype].append(dur)

        elif t == "guardrail_block":
            key = f'{evt.get("hook", "unknown")}:{evt.get("rule", "unknown")}'
            guardrail_blocks[key] += 1

        phase = evt.get("phase", "adhoc")
        if phase in valid_phases:
            phase_counts[phase] += 1
        total_events += 1

metrics = []

# Agent cycle times
for atype, durations in sorted(agent_durations.items()):
    if not durations:
        continue
    avg = sum(durations) / len(durations)
    sorted_d = sorted(durations)
    p90_idx = int(len(sorted_d) * 0.9)
    p90 = sorted_d[min(p90_idx, len(sorted_d) - 1)]

    labels = f'project="{project}",agent_type="{atype}"'
    metrics.append(f"METRIC:agent_cycle_time_avg_seconds|{labels}|{avg:.1f}|Average agent completion time by type")
    metrics.append(f"METRIC:agent_cycle_time_p90_seconds|{labels}|{p90:.1f}|90th percentile agent completion time")

# Flow efficiency
if total_events > 0:
    work_events = phase_counts.get("work", 0)
    efficiency = work_events / total_events
    metrics.append(f'METRIC:flow_efficiency_ratio|project="{project}"|{efficiency:.3f}|Ratio of active work to total activity')

    for phase, count in sorted(phase_counts.items()):
        if count > 0:
            metrics.append(f'METRIC:flow_phase_events|project="{project}",phase="{phase}"|{count}|')

    print(f"  Flow Efficiency: {efficiency:.1%} ({work_events} work / {total_events} total events)")
else:
    print("  Flow Efficiency: no events yet")

# Agent summary
if agent_durations:
    total_agents = sum(len(d) for d in agent_durations.values())
    all_durations = [d for ds in agent_durations.values() for d in ds]
    overall_avg = sum(all_durations) / len(all_durations) if all_durations else 0
    print(f"  Agent Cycle Times: {total_agents} completions, avg={overall_avg:.0f}s across {len(agent_durations)} types")
    for atype, durations in sorted(agent_durations.items()):
        avg = sum(durations) / len(durations)
        print(f"    {atype}: n={len(durations)}, avg={avg:.0f}s")
else:
    print("  Agent Cycle Times: no agent_complete events yet")

# Guardrail blocks (data collection only — no panel)
if guardrail_blocks:
    total_blocks = sum(guardrail_blocks.values())
    print(f"  Guardrail Blocks: {total_blocks} total")
    for key, count in sorted(guardrail_blocks.items()):
        metrics.append(f'METRIC:guardrail_block_count|project="{project}",rule="{key}"|{count}|')

# Output metrics
for m in metrics:
    print(m)
PYEOF
)

  # Parse METRIC: lines from python output and buffer them
  while IFS= read -r line; do
    if [[ "$line" == METRIC:* ]]; then
      local rest="${line#METRIC:}"
      local metric="${rest%%|*}"; rest="${rest#*|}"
      local labels="${rest%%|*}"; rest="${rest#*|}"
      local value="${rest%%|*}"; rest="${rest#*|}"
      local help="$rest"
      buffer_metric "$metric" "$labels" "$value" "$help"
    else
      echo "$line"
    fi
  done <<< "$output"
}
