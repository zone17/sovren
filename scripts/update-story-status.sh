#!/bin/bash
# Update GitHub Issue Status for Agent Progress Tracking
# Usage: ./update-story-status.sh ISSUE_NUMBER STATUS COMPLETION AGENT_NAME [MESSAGE]

set -e

# Project configuration
PROJECT_NUMBER=1
PROJECT_OWNER="zone17"
PROJECT_ID="PVT_kwHOADc3Q84BHW4s"

# Check arguments
if [ $# -lt 4 ]; then
    echo "Usage: $0 ISSUE_NUMBER STATUS COMPLETION AGENT_NAME [MESSAGE]"
    echo ""
    echo "Arguments:"
    echo "  ISSUE_NUMBER   - GitHub issue number (e.g., 123)"
    echo "  STATUS         - Current status (Todo|In Progress|Done)"
    echo "  COMPLETION     - Completion percentage (0-100)"
    echo "  AGENT_NAME     - Name of agent performing work"
    echo "  MESSAGE        - Optional additional message"
    echo ""
    echo "Example:"
    echo "  $0 123 'In Progress' 50 'elite-frontend-dev' 'Completed auth component'"
    exit 1
fi

ISSUE_NUMBER=$1
STATUS=$2
COMPLETION=$3
AGENT=$4
MESSAGE=${5:-""}

# Get repository
REPO=$(gh repo view --json nameWithOwner --jq '.nameWithOwner' 2>/dev/null)

if [ -z "$REPO" ]; then
    echo "❌ Could not detect repository. Are you in a git repository?"
    exit 1
fi

# Validate completion percentage
if [ "$COMPLETION" -lt 0 ] || [ "$COMPLETION" -gt 100 ]; then
    echo "❌ Completion must be between 0 and 100"
    exit 1
fi

# Status emoji mapping
case $STATUS in
    "Backlog")
        STATUS_EMOJI="📋"
        ;;
    "In Design")
        STATUS_EMOJI="🎨"
        ;;
    "In Development")
        STATUS_EMOJI="⚙️"
        ;;
    "In Testing")
        STATUS_EMOJI="🧪"
        ;;
    "In Review")
        STATUS_EMOJI="👀"
        ;;
    "Done")
        STATUS_EMOJI="✅"
        ;;
    *)
        STATUS_EMOJI="📌"
        ;;
esac

# Progress bar
FILLED=$(($COMPLETION / 5))
EMPTY=$((20 - $FILLED))
PROGRESS_BAR=$(printf '█%.0s' $(seq 1 $FILLED))$(printf '░%.0s' $(seq 1 $EMPTY))

# Build comment body
COMMENT_BODY="## ${STATUS_EMOJI} Agent Update

**Agent**: \`${AGENT}\`
**Status**: **${STATUS}**
**Completion**: ${COMPLETION}%

\`\`\`
Progress: [${PROGRESS_BAR}] ${COMPLETION}%
\`\`\`

**Timestamp**: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"

# Add optional message if provided
if [ -n "$MESSAGE" ]; then
    COMMENT_BODY="${COMMENT_BODY}

### Update Notes
${MESSAGE}"
fi

# Add automated signature
COMMENT_BODY="${COMMENT_BODY}

---
*🤖 Automated update from agent \`${AGENT}\`*"

# Post comment to issue
echo "📝 Updating issue #${ISSUE_NUMBER}..."

gh issue comment $ISSUE_NUMBER \
    --repo $REPO \
    --body "$COMMENT_BODY" > /dev/null 2>&1

# Update GitHub Project fields
echo "📊 Updating GitHub Project fields..."

# Get issue node ID
ISSUE_NODE_ID=$(gh api repos/$REPO/issues/$ISSUE_NUMBER --jq '.node_id')

# Get project item ID
ITEM_ID=$(gh api graphql -f query="
  query {
    node(id: \"$PROJECT_ID\") {
      ... on ProjectV2 {
        items(first: 100) {
          nodes {
            id
            content {
              ... on Issue {
                number
              }
            }
          }
        }
      }
    }
  }
" --jq ".data.node.items.nodes[] | select(.content.number == $ISSUE_NUMBER) | .id" 2>/dev/null || echo "")

if [ -n "$ITEM_ID" ]; then
    # Update Status field (PVTSSF_lAHOADc3Q84BHW4szg4ItJE)
    STATUS_FIELD_ID="PVTSSF_lAHOADc3Q84BHW4szg4ItJE"
    case $STATUS in
        "Todo") STATUS_OPTION_ID="f75ad846" ;;
        "In Progress") STATUS_OPTION_ID="47fc9ee4" ;;
        "Done") STATUS_OPTION_ID="98236657" ;;
        *) STATUS_OPTION_ID="" ;;
    esac

    if [ -n "$STATUS_OPTION_ID" ]; then
        gh api graphql -f query="
          mutation {
            updateProjectV2ItemFieldValue(input: {
              projectId: \"$PROJECT_ID\"
              itemId: \"$ITEM_ID\"
              fieldId: \"$STATUS_FIELD_ID\"
              value: {singleSelectOptionId: \"$STATUS_OPTION_ID\"}
            }) {
              projectV2Item { id }
            }
          }
        " > /dev/null 2>&1 || echo "⚠️  Could not update Status field"
    fi

    # Update Agent field (PVTF_lAHOADc3Q84BHW4szg4N3wk)
    AGENT_FIELD_ID="PVTF_lAHOADc3Q84BHW4szg4N3wk"
    gh api graphql -f query="
      mutation {
        updateProjectV2ItemFieldValue(input: {
          projectId: \"$PROJECT_ID\"
          itemId: \"$ITEM_ID\"
          fieldId: \"$AGENT_FIELD_ID\"
          value: {text: \"$AGENT\"}
        }) {
          projectV2Item { id }
        }
      }
    " > /dev/null 2>&1 || echo "⚠️  Could not update Agent field"

    # Update Completion % field (PVTF_lAHOADc3Q84BHW4szg4N33Q)
    COMPLETION_FIELD_ID="PVTF_lAHOADc3Q84BHW4szg4N33Q"
    gh api graphql -f query="
      mutation {
        updateProjectV2ItemFieldValue(input: {
          projectId: \"$PROJECT_ID\"
          itemId: \"$ITEM_ID\"
          fieldId: \"$COMPLETION_FIELD_ID\"
          value: {number: $COMPLETION}
        }) {
          projectV2Item { id }
        }
      }
    " > /dev/null 2>&1 || echo "⚠️  Could not update Completion % field"

    echo "✅ GitHub Project fields updated"
else
    echo "⚠️  Issue not found in project - skipping project field updates"
fi

# Update issue label based on status
case $STATUS in
    "Todo")
        gh issue edit $ISSUE_NUMBER --repo $REPO --add-label "status:todo" --remove-label "status:in-progress,status:done" > /dev/null 2>&1 || true
        ;;
    "In Progress")
        gh issue edit $ISSUE_NUMBER --repo $REPO --add-label "status:in-progress" --remove-label "status:todo,status:done" > /dev/null 2>&1 || true
        ;;
    "Done")
        gh issue edit $ISSUE_NUMBER --repo $REPO --add-label "status:done" --remove-label "status:todo,status:in-progress" > /dev/null 2>&1 || true
        # Close issue if 100% complete
        if [ "$COMPLETION" -eq 100 ]; then
            gh issue close $ISSUE_NUMBER --repo $REPO --comment "✅ **Completed by ${AGENT}** - All acceptance criteria met" > /dev/null 2>&1
            echo "✅ Issue #${ISSUE_NUMBER} closed (100% complete)"
        fi
        ;;
esac

# Success message
echo "✅ Updated issue #${ISSUE_NUMBER}"
echo "   Status: ${STATUS} (${COMPLETION}%)"
echo "   Agent: ${AGENT}"
echo "   View: https://github.com/${REPO}/issues/${ISSUE_NUMBER}"
echo ""

# Show progress summary if verbose
if [ "${VERBOSE:-0}" = "1" ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Issue Summary:"
    gh issue view $ISSUE_NUMBER --repo $REPO | head -20
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
fi
