---
status: complete
priority: p2
issue_id: '290'
tags: [code-review, frontend, race-condition]
dependencies: []
---

# Batch Action Clears Selection Before Server Confirms

## Problem Statement

InboxToolbar dispatches batch actions and immediately clears the selection state. If the server request fails, the UI shows no selection but the action didn't apply — user loses track of which items were selected.

## Findings

- `packages/frontend/src/features/multi-platform/components/InboxToolbar.tsx` — clears selection before awaiting response

## Proposed Solutions

### Option 1: Clear selection on success only

**Approach:** Move setSelectedIds([]) into the .then() handler after server confirms success. Show error toast and preserve selection on failure.
**Effort:** 30min **Risk:** Low

## Acceptance Criteria

- [ ] Selection preserved until server confirms
- [ ] Error toast on failure with selection intact
- [ ] Success clears selection normally

## Work Log

### 2026-02-18 - Code Review Discovery

**By:** Claude Code (13-agent parallel review)
