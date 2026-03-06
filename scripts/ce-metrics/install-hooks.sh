#!/usr/bin/env bash
# CE Metrics — Install Hooks
# Copies hook scripts to ~/.claude/hooks/ce-metrics/ and registers them in settings.json

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOKS_SRC="$SCRIPT_DIR/hooks"
HOOKS_DEST="$HOME/.claude/hooks/ce-metrics"
SETTINGS_FILE="$HOME/.claude/settings.json"

echo "Installing CE metrics hooks..."

# 1. Create destination directory
mkdir -p "$HOOKS_DEST"

# 2. Copy all hook scripts
cp "$HOOKS_SRC"/*.sh "$HOOKS_DEST/"
chmod +x "$HOOKS_DEST"/*.sh

echo "Copied hooks to $HOOKS_DEST"
ls -la "$HOOKS_DEST/"

# 3. Patch settings.json — check each hook entry individually (#688)
if [ ! -f "$SETTINGS_FILE" ]; then
  echo "ERROR: $SETTINGS_FILE not found"
  exit 1
fi

# Backup settings before modification
cp "$SETTINGS_FILE" "$SETTINGS_FILE.bak"
echo "Backed up settings.json to $SETTINGS_FILE.bak"

# Define hook registrations as (event|matcher|command|timeout) tuples
declare -a HOOKS=(
  "SessionStart||bash ~/.claude/hooks/ce-metrics/session-start.sh|5000"
  "SessionStart||bash ~/.claude/hooks/ce-metrics/context-reinject.sh|3000"
  "Stop||bash ~/.claude/hooks/ce-metrics/turn-complete.sh|"
  "SubagentStart||bash ~/.claude/hooks/ce-metrics/agent-spawn.sh|"
  "SubagentStop||bash ~/.claude/hooks/ce-metrics/agent-complete.sh|15000"
  "PostToolUse|Bash|bash ~/.claude/hooks/ce-metrics/git-event.sh|"
  "TaskCompleted||bash ~/.claude/hooks/ce-metrics/task-complete.sh|"
  "SessionEnd||bash ~/.claude/hooks/ce-metrics/session-end.sh|60000"
)

tmp_file=$(mktemp)
cp "$SETTINGS_FILE" "$tmp_file"

needs_update=false

for hook_def in "${HOOKS[@]}"; do
  IFS='|' read -r event matcher command timeout <<< "$hook_def"

  # Check if this specific command is already registered
  if grep -q "$command" "$tmp_file" 2>/dev/null; then
    echo "  Already registered: $event -> $command"
    continue
  fi

  needs_update=true
  echo "  Adding: $event -> $command"

  # Build the hook entry JSON
  hook_json="{\"type\":\"command\",\"command\":\"$command\""
  [ -n "$timeout" ] && hook_json="$hook_json,\"timeout\":$timeout"
  hook_json="$hook_json}"

  # Build the registration JSON
  if [ -n "$matcher" ]; then
    reg_json="{\"matcher\":\"$matcher\",\"hooks\":[$hook_json]}"
  else
    reg_json="{\"hooks\":[$hook_json]}"
  fi

  # Add to settings using jq
  jq --arg event "$event" --argjson reg "$reg_json" '
    .hooks[$event] = (.hooks[$event] // []) + [$reg]
  ' "$tmp_file" > "$tmp_file.new"
  mv "$tmp_file.new" "$tmp_file"
done

if [ "$needs_update" = true ]; then
  # Validate output is valid JSON before replacing
  if jq empty "$tmp_file" 2>/dev/null; then
    mv "$tmp_file" "$SETTINGS_FILE"
    echo "settings.json updated successfully"
  else
    echo "ERROR: Generated settings.json is invalid JSON — restoring backup"
    cp "$SETTINGS_FILE.bak" "$SETTINGS_FILE"
    rm -f "$tmp_file"
    exit 1
  fi
else
  echo "All hooks already registered — no changes needed"
  rm -f "$tmp_file"
fi

echo ""
echo "CE metrics hooks installed successfully."
echo "  Hooks location: $HOOKS_DEST"
echo "  To disable metrics: touch ~/.claude/metrics/.disabled"
echo "  To re-enable: rm ~/.claude/metrics/.disabled"
echo "  Health check: bash $SCRIPT_DIR/check-health.sh"
