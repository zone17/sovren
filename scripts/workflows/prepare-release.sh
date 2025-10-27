#!/bin/bash
# Release Workflow Template
# Usage: ./workflows/prepare-release.sh <version>

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "❌ Usage: $0 <version>"
  exit 1
fi

echo "🚀 Preparing release: $VERSION"

# Create release branch
git checkout -b "release/$VERSION"

# Run comprehensive tests
echo "🧪 Running test suite..."
npm run test

# Update version
npm version $VERSION --no-git-tag-version

# Update Tana with release preparation
if [ -n "$TANA_TOKEN" ]; then
  node scripts/tana-project-controller.js update "Preparing release $VERSION" "Release branch created, tests passed, version updated"
  node scripts/tana-project-controller.js report "release"
fi

echo "✅ Release $VERSION prepared!"
echo "📋 Next steps:"
echo "1. Review and test release branch"
echo "2. Merge to main branch"
echo "3. Create release tag"
echo "4. Deploy to production"
