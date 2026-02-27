#!/usr/bin/env bash
# setup-ruleset.sh — Idempotent GitHub Ruleset configuration for Sovren
# Run: bash scripts/setup-ruleset.sh
# Requires: gh CLI authenticated with admin access

set -euo pipefail

REPO="zone17/sovren"
RULESET_NAME="main-protection"

echo "=== Sovren GitHub Governance Setup ==="
echo ""

# Step 1: Configure repo merge settings (squash-only, auto-delete)
echo "1. Configuring merge settings..."
gh api -X PATCH "/repos/${REPO}" \
  -f allow_merge_commit=false \
  -f allow_rebase_merge=false \
  -f allow_squash_merge=true \
  -f squash_merge_commit_title="PR_TITLE" \
  -f squash_merge_commit_message="PR_BODY" \
  -f delete_branch_on_merge=true \
  --silent
echo "   Squash-only merge + auto-delete enabled"

# Step 2: Check if ruleset already exists
echo "2. Checking for existing ruleset..."
EXISTING=$(gh api "/repos/${REPO}/rulesets" --jq ".[] | select(.name == \"${RULESET_NAME}\") | .id" 2>/dev/null || echo "")

if [ -n "$EXISTING" ]; then
  echo "   Ruleset '${RULESET_NAME}' already exists (id: ${EXISTING}). Updating..."
  METHOD="-X PUT"
  ENDPOINT="/repos/${REPO}/rulesets/${EXISTING}"
else
  echo "   Creating new ruleset '${RULESET_NAME}'..."
  METHOD="-X POST"
  ENDPOINT="/repos/${REPO}/rulesets"
fi

# Step 3: Create/update the ruleset
gh api ${METHOD} "${ENDPOINT}" \
  --input - <<'EOF'
{
  "name": "main-protection",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "include": ["refs/heads/main"],
      "exclude": []
    }
  },
  "bypass_actors": [
    {
      "actor_id": 5,
      "actor_type": "RepositoryRole",
      "bypass_mode": "pull_request"
    }
  ],
  "rules": [
    {
      "type": "deletion"
    },
    {
      "type": "non_fast_forward"
    },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 1,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": true,
        "require_last_push_approval": true,
        "required_review_thread_resolution": true
      }
    },
    {
      "type": "required_linear_history"
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [
          { "context": "CI / Test Gate" },
          { "context": "CI / Lint" },
          { "context": "CI / Type Check" }
        ]
      }
    },
    {
      "type": "merge_queue",
      "parameters": {
        "check_response_timeout_minutes": 45,
        "grouping_strategy": "ALLGREEN",
        "max_entries_to_build": 5,
        "min_entries_to_merge": 1,
        "merge_method": "SQUASH"
      }
    }
  ]
}
EOF

echo "   Ruleset configured successfully"

# Step 4: Verify
echo ""
echo "3. Verifying ruleset..."
gh api "/repos/${REPO}/rulesets" --jq '.[] | select(.name == "main-protection") | "   Name: \(.name)\n   Enforcement: \(.enforcement)\n   Rules: \(.rules | length)"'

echo ""
echo "=== Setup complete ==="
echo ""
echo "Next steps:"
echo "  1. Create GitHub teams: @zone17/tech-leads, @zone17/squad-a, @zone17/squad-b"
echo "  2. Grant teams write access to the repository"
echo "  3. Test: create a PR, verify CODEOWNERS auto-assigns reviewers"
echo "  4. Test: try 'git push origin main' — should be rejected"
echo "  5. Test: merge 2 PRs via merge queue — should serialize"
