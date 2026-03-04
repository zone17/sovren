---
title: 'Cross-Squad Branch Pollution — Three-Layer Defense'
date: '2026-03-04'
category: git-maintenance
module: development-workflow
problem_type: process-enforcement
severity: medium
status: completed
symptoms:
  - 'Claude Code commits squad-b work onto squad-a branch'
  - 'Same session commits to wrong branch 3+ times'
  - 'Cherry-pick/rebase recovery needed mid-session'
  - 'No validation of branch name before commit or push'
root_cause: 'Process gap — no systematic branch verification protocol at session start, pre-commit, pre-push, or task switch. BRANCHING_STRATEGY.md existed but lacked procedural enforcement.'
tags:
  - git-workflow
  - branch-discipline
  - multi-squad
  - process-enforcement
  - hooks
---

# Cross-Squad Branch Pollution — Three-Layer Defense

## Problem Statement

During the Slice 4 (Payments & Creator Profiles) session, Claude Code committed squad-b work onto squad-a's branch **3 times** in a single session. Each occurrence required cherry-picks and branch resets to recover.

### Timeline of Violations

1. **Violation 1**: Committed P1/P2 fixes for Slice 4 (squad-b) onto `feat/squad-a/slice3-content-shield-mvp`
2. **Violation 2**: After cherry-picking to squad-b branch, switched back to squad-a for a lint fix
3. **Violation 3**: Same pattern — started work without verifying branch

**User diagnosis**: "it's not just failures on the CI — it's failures on our ways of working with the branching strategy. I believe it may be process/workflow and not technology."

## Root Cause Analysis

### Why It Kept Happening

1. **Strategy vs. Discipline** — BRANCHING_STRATEGY.md explained WHAT to do but not WHEN to verify
2. **No pre-commit verification** — Changes were committed before checking `git branch --show-current`
3. **No session-start protocol** — No systematic first action to verify branch alignment
4. **Silent failures** — Wrong-branch commits didn't fail CI or produce warnings
5. **Context window fatigue** — After multiple task switches, branch context was lost

### Why Documentation Alone Was Insufficient

- BRANCHING_STRATEGY.md was referenced in every team brief
- Agents read it once during onboarding, forgot by work time
- No runtime enforcement or hooks to catch violations

## Solution: Three-Layer Defense

### Layer 1: CLAUDE.md Behavioral Protocol

Added "Branch Discipline Protocol (MANDATORY)" to `~/.claude/CLAUDE.md` with 4 sub-protocols:

- **Session Start**: `git branch --show-current` as FIRST action, check MEMORY.md squad table
- **Before Every Commit**: Verify branch contains correct squad identifier and slug
- **Before Every Push**: Same verification + `git log --oneline -3` to confirm commits belong
- **When Switching Tasks**: `git checkout` is FIRST action — before reading ANY files

**Key insight**: The ORDER matters. Branch verification before file reads prevents mental model mismatch.

### Layer 2: Git Hooks (Automated)

Added branch name validation as step 0 in `.husky/pre-commit` and `.husky/pre-push`:

```bash
current_branch=$(git branch --show-current)
if [ -n "$current_branch" ] && [ "$current_branch" != "main" ]; then
  if ! echo "$current_branch" | grep -qE '^(feat|fix|docs|refactor|test|chore|perf|ci|build|hotfix)/'; then
    echo "WARNING: Branch '$current_branch' doesn't follow naming convention"
    echo "Expected: {type}/{squad}/{ticket}-{slug}"
  fi
fi
```

### Layer 3: Memory Protocol (State)

Formalized Active Squad Assignments in MEMORY.md as a table:

| Squad   | Slice                                | Branch                                   | Status   |
| ------- | ------------------------------------ | ---------------------------------------- | -------- |
| Squad A | Slice 3: Content Shield MVP          | `feat/squad-a/slice3-content-shield-mvp` | Active   |
| Squad B | Slice 4: Payments & Creator Profiles | merged to main                           | Complete |

## What Didn't Work

1. **Documentation alone** — BRANCHING_STRATEGY.md existed, was read once, forgotten
2. **Context window decay** — Longer sessions = more task switches = higher pollution risk
3. **No negative feedback** — Wrong-branch commits succeeded silently
4. **Task assignments decoupled from branches** — Tasks said "Squad B" but didn't state explicit branch name

## Prevention Strategies

1. Every session starts with `git branch --show-current` + MEMORY.md check
2. Pre-commit/pre-push hooks validate branch naming convention
3. Every team brief includes explicit `BRANCH FOR THIS WORK: {name}`
4. MEMORY.md table updated at sprint boundaries with active squad/branch mappings

## Files Modified

- `~/.claude/CLAUDE.md` — Added Branch Discipline Protocol section
- `.husky/pre-commit` — Added branch name validation (step 0)
- `.husky/pre-push` — Added branch name validation (step 0)
- `~/.claude/projects/-Users-fp/memory/MEMORY.md` — Formalized squad assignments table

## Cross-References

- [BRANCHING_STRATEGY.md](../../development/BRANCHING_STRATEGY.md) — Branch naming, merge flow
- [common-solutions.md](../patterns/common-solutions.md) — Patterns #47-49 (sprint cleanup), #77 (worktree isolation), #78 (branch verification)
- [repo-cruft-prevention-20260226.md](./repo-cruft-prevention-20260226.md) — Repo health checklist

## Key Takeaway

Branch pollution is a **process failure, not a technology failure**. The solution is three layers of increasing strictness: guidance (CLAUDE.md), enforcement (git hooks), context (MEMORY.md table). Combined, they eliminate the information decay that caused the incident.
