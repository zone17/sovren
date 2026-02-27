---
status: pending
priority: p2
issue_id: '554'
tags: [code-review, ci-cd, pr-104]
---

# branch-cleanup.yml broken for squash merges — delete it

## Problem Statement

`branch-cleanup.yml` uses `git branch -r --merged origin/main` which cannot detect squash-merged branches (squash creates a new commit on main — original branch commits are unreachable). Since the repo uses squash-only merges, this workflow is a no-op. Additionally, `delete_branch_on_merge: true` is already configured in `setup-ruleset.sh`, handling 95% of branch cleanup automatically.

## Findings

- **3/3 agents flagged** (security, patterns, simplicity)
- Confirmed by MEMORY.md: "git branch --merged doesn't detect squash merges"
- `delete_branch_on_merge: true` already configured — makes this redundant
- Pre-Sprint Repo Cleanup (02-26) did manual cleanup successfully in minutes

## Proposed Solutions

### Delete branch-cleanup.yml (Recommended)

- **Effort**: Tiny
- **Risk**: None — auto-delete handles the common case

## Acceptance Criteria

- [ ] `.github/workflows/branch-cleanup.yml` deleted
