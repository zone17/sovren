---
status: pending
priority: p2
issue_id: 507
tags: [code-review, frontend, singleton, stale-state]
dependencies: []
---

# P2: CachePersistenceService stale singleton after cleanup

## Problem Statement

`CachePersistenceService` has dual singleton paths: `CachePersistenceService.getInstance()` (static) and `getCachePersistence()` (module-level). After `cleanup()`, only the static `instance` is cleared — the module-level `_cachePersistence` variable still holds a reference to the destroyed instance. Any caller using `getCachePersistence()` after cleanup gets a dead service.

## Findings

**File:** `packages/frontend/src/services/nostr/CachePersistenceService.ts`

The `cleanup()` method resets `CachePersistenceService.instance = null` but does NOT clear `_cachePersistence`:

```typescript
// cleanup() at ~line 659-675:
public cleanup(): void {
  if (CachePersistenceService.instance === this) {
    CachePersistenceService.instance = null;  // cleared
  }
  // _cachePersistence is NOT cleared
}

// Module-level singleton at ~line 681-687:
let _cachePersistence: CachePersistenceService | null = null;
export function getCachePersistence(): CachePersistenceService {
  if (!_cachePersistence) {  // Still holds destroyed instance!
    _cachePersistence = CachePersistenceService.getInstance();
  }
  return _cachePersistence;
}
```

## Proposed Solutions

### Option A: Clear module-level var in cleanup (Recommended)
- Add `_cachePersistence = null` in cleanup
- Pros: Minimal change, fixes the bug
- Cons: None
- Effort: Small
- Risk: Low

### Option B: Remove dual singleton, use only getInstance()
- Remove `getCachePersistence()` function, update all callers
- Pros: Eliminates the root cause (dual paths)
- Cons: Larger change, touches multiple files
- Effort: Medium
- Risk: Low

## Recommended Action

Option A — single-line fix.

## Technical Details

- **Affected files:** `packages/frontend/src/services/nostr/CachePersistenceService.ts`
- **Components:** CachePersistenceService, getCachePersistence()

## Acceptance Criteria

- [ ] After `cleanup()`, `getCachePersistence()` returns a fresh instance (not the destroyed one)
- [ ] Tests verify re-initialization after cleanup

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-25 | Identified during manual PR #98 review | Dual singleton paths are a recurring anti-pattern |

## Resources

- PR #98: fix/backend-startup
