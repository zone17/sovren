#!/usr/bin/env bash
# CE Metrics — Agent Complete Hook (sync, timeout: 15s)
# Captures agent token usage and duration

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

ce_check_disabled

# Read input JSON from stdin
input=$(cat)
session_id=$(echo "$input" | jq -r '.session_id // "unknown"' 2>/dev/null || echo "unknown")
agent_id=$(echo "$input" | jq -r '.agent_id // "unknown"' 2>/dev/null || echo "unknown")
agent_type=$(echo "$input" | jq -r '.agent_type // "unknown"' 2>/dev/null || echo "unknown")
agent_transcript=$(echo "$input" | jq -r '.agent_transcript_path // ""' 2>/dev/null || echo "")

# Parse agent transcript for token totals
total_input=0
total_output=0
turns=0
first_ts=""
last_ts=""

if [ -n "$agent_transcript" ] && [ -f "$agent_transcript" ] && command -v jq &>/dev/null; then
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    it=$(echo "$line" | jq -r '.usage.input_tokens // 0' 2>/dev/null || echo 0)
    ot=$(echo "$line" | jq -r '.usage.output_tokens // 0' 2>/dev/null || echo 0)
    ts=$(echo "$line" | jq -r '.timestamp // ""' 2>/dev/null || echo "")
    total_input=$((total_input + it))
    total_output=$((total_output + ot))
    turns=$((turns + 1))
    [ -z "$first_ts" ] && first_ts="$ts"
    last_ts="$ts"
  done < "$agent_transcript"
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
