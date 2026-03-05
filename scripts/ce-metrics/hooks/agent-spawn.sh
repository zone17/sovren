#!/usr/bin/env bash
# CE Metrics — Agent Spawn Hook (async, timeout: 5s)
# Tracks agent spawns for team efficiency metrics

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

ce_check_disabled

# Read input JSON from stdin
input=$(cat)
session_id=$(echo "$input" | jq -r '.session_id // "unknown"' 2>/dev/null || echo "unknown")
agent_id=$(echo "$input" | jq -r '.agent_id // "unknown"' 2>/dev/null || echo "unknown")
agent_type=$(echo "$input" | jq -r '.agent_type // "unknown"' 2>/dev/null || echo "unknown")

emit_event "agent_spawn" \
  "$(jq -cn --arg aid "$agent_id" --arg atype "$agent_type" '{agent_id: $aid, agent_type: $atype}')" \
  "$session_id"
