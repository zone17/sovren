#!/bin/bash
# Link all issues to the GitHub Project

REPO="zone17/sovren"
PROJECT_NUMBER=1
OWNER="zone17"

echo "Linking issues to project #${PROJECT_NUMBER}..."

# Get project ID using GraphQL
PROJECT_ID=$(gh api graphql -f query='
  query($owner: String!, $number: Int!) {
    user(login: $owner) {
      projectV2(number: $number) {
        id
      }
    }
  }
' -f owner="$OWNER" -F number=$PROJECT_NUMBER --jq '.data.user.projectV2.id')

echo "Project ID: $PROJECT_ID"

# Get all issue numbers
ISSUE_NUMBERS=$(gh issue list --repo $REPO --limit 100 --state all --json number --jq '.[].number')

count=0
for issue_number in $ISSUE_NUMBERS; do
  echo -n "Linking issue #$issue_number... "

  # Get issue node ID
  ISSUE_NODE_ID=$(gh api repos/$REPO/issues/$issue_number --jq '.node_id')

  # Add issue to project
  result=$(gh api graphql -f query='
    mutation($project: ID!, $issue: ID!) {
      addProjectV2ItemById(input: {projectId: $project, contentId: $issue}) {
        item {
          id
        }
      }
    }
  ' -f project="$PROJECT_ID" -f issue="$ISSUE_NODE_ID" 2>&1)

  if [ $? -eq 0 ]; then
    echo "✓"
    count=$((count + 1))
  else
    # Check if already added
    if echo "$result" | grep -q "already exists"; then
      echo "already added"
    else
      echo "✗ Failed: $result"
    fi
  fi

  # Rate limit: small delay between requests
  sleep 0.5
done

echo ""
echo "================================================================"
echo "Successfully linked $count issues to project #${PROJECT_NUMBER}"
echo "================================================================"
echo ""
echo "View the project board: https://github.com/users/$OWNER/projects/$PROJECT_NUMBER"
