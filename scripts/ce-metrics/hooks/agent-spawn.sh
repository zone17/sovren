#!/usr/bin/env bash
# CE Metrics — Agent Spawn Hook (async, timeout: 5s)
# Tracks agent spawns for team efficiency metrics

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

ce_init

agent_id=$(ce_get_field "$input" ".agent_id" "unknown")
agent_type=$(ce_get_field "$input" ".agent_type" "unknown")

emit_event "agent_spawn" \
  "$(jq -cn --arg aid "$agent_id" --arg atype "$agent_type" '{agent_id: $aid, agent_type: $atype}')" \
  "$session_id"
