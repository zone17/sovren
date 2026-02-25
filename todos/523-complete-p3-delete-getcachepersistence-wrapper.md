---
status: pending
priority: p3
issue_id: '523'
tags: [code-review, simplicity, dead-code]
dependencies: []
---

# Delete getCachePersistence() Dead Wrapper

## Problem Statement

After singleton consolidation in PR #98, `getCachePersistence()` is a one-line pass-through to `CachePersistenceService.getInstance()` with zero callers across the entire codebase.

## Findings

- **code-simplicity-reviewer** (1/8 agents flagged)
- File: `packages/frontend/src/services/nostr/CachePersistenceService.ts`, lines 681-683
- Grep confirmed zero import sites

## Proposed Solutions

### Option A: Delete the function (Recommended)

- Remove the 3-line function and its JSDoc comment
- Effort: Trivial (30 seconds)
- Risk: None — zero callers

## Acceptance Criteria

- [ ] `getCachePersistence()` function removed
- [ ] No import errors across codebase

## Work Log

| Date       | Action                                        | Learnings                               |
| ---------- | --------------------------------------------- | --------------------------------------- |
| 2026-02-25 | Created from PR #98 review (8-agent parallel) | Simplicity agent confirmed zero callers |
