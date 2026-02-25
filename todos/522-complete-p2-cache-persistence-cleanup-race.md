---
status: pending
priority: p2
issue_id: '522'
tags: [code-review, performance, data-integrity]
dependencies: []
---

# CachePersistenceService cleanup() Async Race

## Problem Statement

`cleanup()` is synchronous but calls `flushPendingSaves()` which is async. The flush fires but is not awaited. `this.db.close()` executes immediately after, potentially cutting short the IndexedDB transaction and causing data loss during shutdown.

## Findings

- **performance-oracle** (1/8 agents flagged)
- File: `packages/frontend/src/services/nostr/CachePersistenceService.ts`, lines 659-675
- Pre-existing issue, in a file changed by PR #98

```typescript
// Current (race condition):
public cleanup(): void {
  if (this.saveTimer) { clearInterval(this.saveTimer); }
  if (CachePersistenceService.instance === this) {
    CachePersistenceService.instance = null;
  }
  this.flushPendingSaves();  // async but not awaited!
  if (this.db) { this.db.close(); this.db = null; }  // closes before flush completes
}
```

## Proposed Solutions

### Option A: Make cleanup() async (Recommended)

```typescript
public async cleanup(): Promise<void> {
  if (this.saveTimer) { clearInterval(this.saveTimer); }
  if (CachePersistenceService.instance === this) {
    CachePersistenceService.instance = null;
  }
  await this.flushPendingSaves();
  if (this.db) { this.db.close(); this.db = null; }
}
```

- Effort: Small (10 min)
- Risk: Low — callers that don't await cleanup() get same behavior as before

## Technical Details

- Affected files: `packages/frontend/src/services/nostr/CachePersistenceService.ts`

## Acceptance Criteria

- [ ] `cleanup()` awaits `flushPendingSaves()` before closing db
- [ ] Existing tests pass

## Work Log

| Date       | Action                                        | Learnings                               |
| ---------- | --------------------------------------------- | --------------------------------------- |
| 2026-02-25 | Created from PR #98 review (8-agent parallel) | Performance agent identified async race |
