#!/usr/bin/env bash
# CE Metrics — GitHub API Helper Library
# Shared PR list fetch and batched actions/runs queries

REPO="${GITHUB_REPO:-zone17/sovren}"

# Shared data — set by fetch functions, consumed by collectors
PR_DATA=""
PR_SHAS=""
RUNS_DATA=""

# Fetch merged PRs once (used by velocity, time, gate rate, failure rate)
fetch_merged_prs() {
  # Note: 'commits' field excluded — hits GraphQL 500k node limit at 200 PRs
  PR_DATA=$(gh pr list --repo "$REPO" --state merged \
    --json number,title,createdAt,mergedAt,headRefName,additions,deletions,mergeCommit \
    --limit 200 2>/dev/null) || PR_DATA="[]"

  [ "$PR_DATA" != "[]" ] && [ -n "$PR_DATA" ] || { echo "  WARNING: Could not fetch merged PRs"; return; }

  # Extract merge commit SHAs for run matching
  PR_SHAS=$(echo "$PR_DATA" | python3 -c "
import json, sys
prs = json.loads(sys.stdin.read())
for pr in prs:
    sha = pr.get('mergeCommit', {}).get('oid', '')
    if sha:
        print(sha)
" 2>/dev/null) || PR_SHAS=""

  local count
  count=$(echo "$PR_DATA" | python3 -c "import json,sys; print(len(json.loads(sys.stdin.read())))" 2>/dev/null || echo "0")
  echo "  Fetched $count merged PRs"
}

# Fetch CI runs in batch (1-2 API calls instead of per-PR)
fetch_actions_runs() {
  # Rate limit check — skip if low
  local remaining
  remaining=$(gh api rate_limit --jq '.rate.remaining' 2>/dev/null || echo "1000")
  if [ "$remaining" -lt 100 ]; then
    echo "  WARNING: GitHub API rate limit low ($remaining remaining), skipping runs fetch"
    RUNS_DATA='{"workflow_runs":[]}'
    return
  fi

  # Fetch completed runs — single paginated call covers ~100 recent runs
  RUNS_DATA=$(gh api "repos/$REPO/actions/runs?per_page=100&status=completed" 2>/dev/null) || RUNS_DATA='{"workflow_runs":[]}'

  local count
  count=$(echo "$RUNS_DATA" | python3 -c "import json,sys; print(len(json.loads(sys.stdin.read()).get('workflow_runs',[])))" 2>/dev/null || echo "0")
  echo "  Fetched $count CI runs (batched)"
}
