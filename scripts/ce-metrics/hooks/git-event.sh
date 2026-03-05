#!/usr/bin/env bash
# CE Metrics — Git Event Hook (async, timeout: 5s)
# Detects git commit/push/merge from PostToolUse[Bash]
# SECURITY: Only reads first 2 words of command via case match

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

ce_init

# Fast-exit: only process Bash tool events
tool_name=$(ce_get_field "$input" ".tool_name" "")
[ "$tool_name" = "Bash" ] || exit 0

# Extract ONLY the first few words of the command for classification
# NEVER store or log the full command
cmd_prefix=$(echo "$input" | jq -r '.tool_input.command // ""' 2>/dev/null | head -c 30 || echo "")

git_verb=$(classify_git_command "$cmd_prefix")
[ -n "$git_verb" ] || exit 0

# For pr_merge, try to extract PR number from the prefix only
pr_number=""
if [ "$git_verb" = "pr_merge" ]; then
  pr_number=$(echo "$cmd_prefix" | grep -oE '#[0-9]+' | head -1 | tr -d '#' || echo "")
fi

emit_event "$git_verb" \
  "$(jq -cn --arg pr "$pr_number" '{pr_number: $pr}')" \
  "$session_id"
