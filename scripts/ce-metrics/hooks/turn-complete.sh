#!/usr/bin/env bash
# CE Metrics — Turn Complete Hook (async, timeout: 10s)
# Captures per-turn token usage from transcript

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

ce_init

transcript_path=$(ce_get_field "$input" ".transcript_path" "")

[ -n "$transcript_path" ] || exit 0

# Parse token data from last turn
token_data=$(parse_last_turn_tokens "$transcript_path")
[ -n "$token_data" ] || exit 0

emit_event "turn_complete" "$token_data" "$session_id"
