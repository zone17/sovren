---
status: complete
priority: p1
issue_id: '263'
tags: [code-review, bug]
dependencies: []
---

# Dead Ternary in completeOrder release_status

## Problem Statement

`release_status: isFinalFailure ? 'failed' : 'failed'` — both branches return 'failed'. No distinction between retryable and permanent failure.

## Findings

- `packages/backend/src/services/community/MarketplaceService.ts:410` — tautological ternary

## Proposed Solutions

### Option 1: Distinguish failure types

**Approach:** Change to `isFinalFailure ? 'permanently_failed' : 'failed'`. Add 'permanently_failed' to CHECK constraint.
**Effort:** 15min **Risk:** Low

## Acceptance Criteria

- [ ] Retryable vs permanent failure distinguishable in DB
- [ ] CHECK constraint updated
- [ ] Tests verify both paths

## Work Log

### 2026-02-18 - Code Review Discovery

**By:** Claude Code (13-agent parallel review)
