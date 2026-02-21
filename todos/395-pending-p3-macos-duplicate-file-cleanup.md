---
status: pending
priority: p3
issue_id: 395
tags:
  - code-review
  - process
  - tooling
dependencies: []
---

# macOS Finder Duplicate File Prevention

## Problem Statement

macOS Finder created " 2.md" duplicate todo files during the review process. These were cleaned up manually but could reappear if the same workflow is used again. Finder automatically appends " 2" to filenames when it detects a conflict, creating confusing duplicates in the todos directory.

## Findings

**Source agents:** process-agent, code-review-agent

**Evidence:**

- File: `todos/`
- Issue: Finder-created duplicate files with " 2.md" suffix appeared in the todos directory during review workflows. These are not valid todo files and pollute the directory listing.

## Proposed Solutions

### Option A: .gitignore pattern

- **Approach:** Add a .gitignore pattern to exclude Finder duplicate files: `* 2.md`, `* 3.md`, etc. This prevents them from being committed but doesn't prevent their creation.
- **Effort:** Small
- **Risk:** Low

### Option B: Pre-commit hook check

- **Approach:** Add a pre-commit hook that checks for files matching the Finder duplicate pattern (`* [0-9].md`, `* [0-9][0-9].md`) and warns or blocks the commit.
- **Effort:** Small
- **Risk:** Low

### Option C: Both .gitignore and pre-commit

- **Approach:** Combine Options A and B for defense in depth. The .gitignore catches accidental staging, and the pre-commit hook provides an explicit warning.
- **Effort:** Small
- **Risk:** Low

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected files:**

- `.gitignore` (add pattern)
- `.husky/pre-commit` or equivalent (add check)
- `todos/` (directory where duplicates appeared)

## Acceptance Criteria

- [ ] .gitignore pattern added for Finder duplicate files
- [ ] Pre-commit hook warns about Finder duplicates (optional)
- [ ] Existing Finder duplicates cleaned up if any remain
- [ ] Pattern documented so team knows why it exists

## Work Log

| Date       | Action  | Notes                      |
| ---------- | ------- | -------------------------- |
| 2026-02-19 | Created | PR #86 code review finding |

## Resources

- PR: https://github.com/zone17/sovren/pull/86
