#!/bin/bash
# Bug Fix Workflow Template
# Usage: ./workflows/start-bugfix.sh <bug-description>

BUG_DESC=$1

if [ -z "$BUG_DESC" ]; then
  echo "❌ Usage: $0 <bug-description>"
  exit 1
fi

echo "🐛 Starting bug fix: $BUG_DESC"

# Create bugfix branch
BRANCH_NAME="bugfix/$(echo $BUG_DESC | tr ' ' '-' | tr '[:upper:]' '[:lower:]')"
git checkout -b "$BRANCH_NAME"

# Update Tana
if [ -n "$TANA_TOKEN" ]; then
  node scripts/tana-project-controller.js update "Started bug fix: $BUG_DESC" "Bug fix branch created and investigation begun"
fi

echo "✅ Bug fix environment ready!"
echo "📁 Bug fix branch: $BRANCH_NAME"
