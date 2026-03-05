#!/usr/bin/env bash
# CE Metrics — Agent Complete Hook (sync, timeout: 15s)
# Captures agent token usage and duration

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

ce_init

agent_id=$(ce_get_field "$input" ".agent_id" "unknown")
agent_type=$(ce_get_field "$input" ".agent_type" "unknown")
agent_transcript=$(ce_get_field "$input" ".agent_transcript_path" "")

# Parse agent transcript with single-pass jq -s (fixes #682 line-by-line parsing)
total_input=0
total_output=0
turns=0
first_ts=""
last_ts=""

if [ -n "$agent_transcript" ] && [ -f "$agent_transcript" ]; then
  read -r total_input total_output turns first_ts last_ts < <(
    jq -sr '
      {
        input: ([.[].usage.input_tokens // 0] | add // 0),
        output: ([.[].usage.output_tokens // 0] | add // 0),
        turns: length,
        first_ts: (first.timestamp // ""),
        last_ts: (last.timestamp // "")
      } | "\(.input) \(.output) \(.turns) \(.first_ts) \(.last_ts)"
    ' "$agent_transcript" 2>/dev/null || echo "0 0 0  "
  )
fi

# Calculate duration in seconds (approximate from timestamps)
duration=0
if [ -n "$first_ts" ] && [ -n "$last_ts" ]; then
  first_epoch=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$first_ts" +%s 2>/dev/null || date -d "$first_ts" +%s 2>/dev/null || echo 0)
  last_epoch=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$last_ts" +%s 2>/dev/null || date -d "$last_ts" +%s 2>/dev/null || echo 0)
  duration=$((last_epoch - first_epoch))
  [ "$duration" -lt 0 ] && duration=0
fi

emit_event "agent_complete" \
  "$(jq -cn \
    --arg aid "$agent_id" \
    --arg atype "$agent_type" \
    --argjson it "$total_input" \
    --argjson ot "$total_output" \
    --argjson turns "$turns" \
    --argjson dur "$duration" \
    '{agent_id: $aid, agent_type: $atype, input_tokens: $it, output_tokens: $ot, turns: $turns, duration_seconds: $dur}')" \
  "$session_id"
