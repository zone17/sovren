#!/usr/bin/env bash
# CE Metrics — Context Re-injection Hook (SessionStart)
# Echoes the 5 most recently added patterns from common-solutions.md
# so fresh lessons stay in context even after compaction.

COMMON_SOLUTIONS="$HOME/Desktop/Sovren/docs/solutions/patterns/common-solutions.md"

# If the file doesn't exist, output nothing
[ -f "$COMMON_SOLUTIONS" ] || exit 0

# Extract the last 5 pattern sections: heading + first non-empty line after it
# Pattern headings look like: ## 88. Dialog `aria-labelledby` Per-Instance IDs in Lists
patterns=$(awk '
  /^## [0-9]+\./ {
    if (heading != "") {
      entries[count++] = heading "\n" body
    }
    heading = $0
    body = ""
    next
  }
  heading != "" && body == "" && /^[^\s]/ && !/^---$/ && !/^```/ && !/^$/ {
    body = $0
  }
  END {
    if (heading != "") {
      entries[count++] = heading "\n" body
    }
    # Print last 5
    start = count - 5
    if (start < 0) start = 0
    for (i = start; i < count; i++) {
      print entries[i]
      print ""
    }
  }
' "$COMMON_SOLUTIONS")

[ -z "$patterns" ] && exit 0

# Output as plain text — Claude Code adds stdout from SessionStart hooks as context
cat <<EOF
[CE: Recent Patterns from common-solutions.md — review if relevant to current work]

$patterns
For full details, read: docs/solutions/patterns/common-solutions.md
EOF
