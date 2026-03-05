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

# 3. Patch settings.json — add hook registrations if not already present
if [ ! -f "$SETTINGS_FILE" ]; then
  echo "ERROR: $SETTINGS_FILE not found"
  exit 1
fi

# Check if CE metrics hooks are already registered
if grep -q "ce-metrics" "$SETTINGS_FILE" 2>/dev/null; then
  echo "CE metrics hooks already registered in settings.json — skipping"
  exit 0
fi

echo "Patching settings.json..."

# Use jq to add hook entries additively
tmp_file=$(mktemp)

jq '
  # SessionStart hook
  .hooks.SessionStart = (.hooks.SessionStart // []) + [
    {
      "hooks": [
        {
          "type": "command",
          "command": "bash ~/.claude/hooks/ce-metrics/session-start.sh",
          "timeout": 5000
        }
      ]
    }
  ] |

  # Stop hook (async, no timeout = fire-and-forget)
  .hooks.Stop = (.hooks.Stop // []) + [
    {
      "hooks": [
        {
          "type": "command",
          "command": "bash ~/.claude/hooks/ce-metrics/turn-complete.sh"
        }
      ]
    }
  ] |

  # SubagentStart hook
  .hooks.SubagentStart = (.hooks.SubagentStart // []) + [
    {
      "hooks": [
        {
          "type": "command",
          "command": "bash ~/.claude/hooks/ce-metrics/agent-spawn.sh"
        }
      ]
    }
  ] |

  # SubagentStop hook
  .hooks.SubagentStop = (.hooks.SubagentStop // []) + [
    {
      "hooks": [
        {
          "type": "command",
          "command": "bash ~/.claude/hooks/ce-metrics/agent-complete.sh",
          "timeout": 15000
        }
      ]
    }
  ] |

  # PostToolUse Bash hook — add alongside existing PostToolUse entries
  .hooks.PostToolUse = (.hooks.PostToolUse // []) + [
    {
      "matcher": "Bash",
      "hooks": [
        {
          "type": "command",
          "command": "bash ~/.claude/hooks/ce-metrics/git-event.sh"
        }
      ]
    }
  ] |

  # TaskCompleted hook — add alongside existing verify-task-complete.sh
  .hooks.TaskCompleted = (.hooks.TaskCompleted // []) + [
    {
      "hooks": [
        {
          "type": "command",
          "command": "bash ~/.claude/hooks/ce-metrics/task-complete.sh"
        }
      ]
    }
  ] |

  # SessionEnd hook
  .hooks.SessionEnd = (.hooks.SessionEnd // []) + [
    {
      "hooks": [
        {
          "type": "command",
          "command": "bash ~/.claude/hooks/ce-metrics/session-end.sh",
          "timeout": 60000
        }
      ]
    }
  ]
' "$SETTINGS_FILE" > "$tmp_file"

# Validate the output is valid JSON before replacing
if jq empty "$tmp_file" 2>/dev/null; then
  cp "$tmp_file" "$SETTINGS_FILE"
  echo "settings.json updated successfully"
else
  echo "ERROR: Generated settings.json is invalid JSON — aborting"
  rm -f "$tmp_file"
  exit 1
fi

rm -f "$tmp_file"

echo ""
echo "CE metrics hooks installed successfully."
echo "  Hooks location: $HOOKS_DEST"
echo "  To disable metrics: touch ~/.claude/metrics/.disabled"
echo "  To re-enable: rm ~/.claude/metrics/.disabled"
