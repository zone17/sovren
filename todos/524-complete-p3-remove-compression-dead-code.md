---
status: pending
priority: p3
issue_id: '524'
tags: [code-review, simplicity, dead-code, yagni]
dependencies: []
---

# Remove Compression Dead Code from CachePersistenceService

## Problem Statement

`CachePersistenceService` has compression infrastructure that was never implemented: `compressEvent()` and `decompressEvent()` are identity functions, `enableCompression` defaults to false, and the `compressed` field on `PersistedEvent` is unused. This is ~27 lines of YAGNI dead code with `any` types.

## Findings

- **code-simplicity-reviewer** (1/8 agents flagged)
- File: `packages/frontend/src/services/nostr/CachePersistenceService.ts`
- Lines: 36 (config), 51 (interface field), 209-213, 302-305, 336-339 (conditionals), 479-490 (methods)

## Proposed Solutions

### Option A: Delete all compression-related code (Recommended)

- Remove `enableCompression` config option
- Remove `compressed` field from `PersistedEvent` interface
- Remove `compressEvent()` and `decompressEvent()` methods
- Remove 3 conditional blocks that check `compressed`
- Effort: Small (15 min)
- Risk: None — config defaults to false, methods are identity functions

## Acceptance Criteria

- [ ] No compression-related code remains in CachePersistenceService
- [ ] Existing tests pass

## Work Log

| Date       | Action                                        | Learnings                      |
| ---------- | --------------------------------------------- | ------------------------------ |
| 2026-02-25 | Created from PR #98 review (8-agent parallel) | Classic YAGNI with `any` types |
