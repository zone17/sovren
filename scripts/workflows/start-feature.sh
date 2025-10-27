#!/bin/bash
# Feature Development Workflow Template
# Usage: ./workflows/start-feature.sh <feature-name>

FEATURE_NAME=$1

if [ -z "$FEATURE_NAME" ]; then
  echo "❌ Usage: $0 <feature-name>"
  exit 1
fi

echo "🚀 Starting feature development: $FEATURE_NAME"

# Create feature branch
git checkout -b "feature/$FEATURE_NAME"

# Update Tana with feature start
if [ -n "$TANA_TOKEN" ]; then
  node scripts/tana-project-controller.js update "Started feature: $FEATURE_NAME" "Feature branch created and development begun"
fi

# Create feature directory structure if needed
mkdir -p "src/features/$FEATURE_NAME"

echo "✅ Feature development environment ready!"
echo "📁 Feature branch: feature/$FEATURE_NAME"
echo "📝 Don't forget to update Tana with your progress!"
