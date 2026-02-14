---
status: pending
priority: p3
issue_id: 104
tags: [code-review, caching, data-structure]
dependencies: []
---

# TTLCache Implementation Issues

## Problem Statement

TTLCache at `packages/backend/src/utils/ttl-cache.ts` has 3 implementation issues affecting correctness and performance:

1. **Stale size reporting**: `size` getter returns `this.map.size` including expired entries, making health metrics report inflated cache sizes
2. **FIFO eviction ignores access patterns**: Frequently-accessed active invoices evicted before stale never-accessed entries. Should use LRU (Least Recently Used) eviction
3. **Mutation during iteration**: `values()` method deletes expired entries during iteration (mutation during read operation)

These issues don't cause crashes but degrade cache effectiveness and metric accuracy in production.

## Findings

- **File**: `packages/backend/src/utils/ttl-cache.ts`
- **Impact**: Health endpoints report incorrect cache sizes, suboptimal eviction leads to cache thrashing, potential iterator invalidation
- **Usage**: Cache is used for invoice data and other time-sensitive backend state
- **Current behavior**: FIFO eviction means first-inserted entries are evicted regardless of access frequency

## Proposed Solutions

### Option 1: Comprehensive TTLCache Refactor

**Description**: Fix all three issues in one pass:

- Add lazy expiry cleanup to `size` getter
- Implement LRU eviction with access-time tracking
- Create separate `cleanExpired()` method, make `values()` non-mutating

**Pros**:

- Fixes all issues comprehensively
- Aligns with standard cache implementation patterns
- Better production metrics and cache hit rates

**Cons**:

- Larger change surface area
- Requires updating all callsites to handle new behavior
- May need performance testing for LRU overhead

**Effort**: Medium (4-6 hours)
**Risk**: Low (well-understood patterns, testable in isolation)

### Option 2: Incremental Fixes

**Description**: Fix issues separately across multiple PRs:

- PR 1: Fix `size` getter (quick win for metrics)
- PR 2: Add LRU eviction policy option (backward compatible)
- PR 3: Refactor `values()` to use generator/snapshot pattern

**Pros**:

- Lower risk per change
- Can prioritize by impact
- Easier to review and test

**Cons**:

- Takes longer overall
- Temporary inconsistency between releases
- More PRs to track

**Effort**: Medium-High (6-8 hours total, spread over time)
**Risk**: Low (incremental, can roll back individual changes)

## Recommended Action

**Option 1** - Comprehensive refactor in single PR.

**Rationale**: TTLCache is a foundational utility with limited surface area. Fixing all issues together ensures consistency and avoids partial-state confusion. The cache is already unit-tested, so regression risk is low. LRU eviction provides immediate production value for invoice caching.

**Implementation approach**:

1. Add `lastAccessed` timestamp to cache entries
2. Update `get()` to track access time
3. Change eviction logic from FIFO to LRU (sort by lastAccessed)
4. Make `size` getter filter expired entries: `Array.from(this.map.values()).filter(e => !this.isExpired(e)).length`
5. Make `values()` return snapshot: `Array.from(this.map.values()).filter(e => !this.isExpired(e)).map(e => e.value)`
6. Add `cleanExpired()` public method for explicit cleanup
7. Update existing tests, add LRU eviction tests

## Technical Details

**Current implementation issues**:

```typescript
// Issue 1: size includes expired entries
get size(): number {
  return this.map.size; // Should exclude expired
}

// Issue 2: FIFO eviction (first inserted, not least recently used)
private evict(): void {
  const firstKey = this.map.keys().next().value;
  this.map.delete(firstKey);
}

// Issue 3: Mutation during iteration
values(): IterableIterator<V> {
  for (const [key, entry] of this.map.entries()) {
    if (this.isExpired(entry)) {
      this.map.delete(key); // MUTATES during iteration
    } else {
      yield entry.value;
    }
  }
}
```

**Proposed LRU implementation**:

```typescript
interface CacheEntry<V> {
  value: V;
  expiresAt: number;
  lastAccessed: number;
}

get(key: K): V | undefined {
  const entry = this.map.get(key);
  if (!entry || this.isExpired(entry)) return undefined;
  entry.lastAccessed = Date.now(); // Track access
  return entry.value;
}

private evict(): void {
  const entries = Array.from(this.map.entries());
  entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
  const lruKey = entries[0][0];
  this.map.delete(lruKey);
}

get size(): number {
  return Array.from(this.map.values()).filter(e => !this.isExpired(e)).length;
}

values(): V[] {
  return Array.from(this.map.values())
    .filter(e => !this.isExpired(e))
    .map(e => e.value);
}
```

**Testing considerations**:

- Add test for size excluding expired entries
- Add test for LRU eviction (access pattern: A, B, C, A, B → evict C)
- Add test for values() snapshot behavior
- Verify no performance regression for large caches (benchmark 10k entries)

## Acceptance Criteria

- [ ] `size` getter excludes expired entries
- [ ] LRU eviction policy implemented (evict least recently accessed, not oldest)
- [ ] `values()` returns snapshot, does not mutate during iteration
- [ ] All existing tests pass
- [ ] New tests for LRU behavior added (minimum 3 test cases)
- [ ] Health metrics report accurate cache sizes in local testing
- [ ] No performance regression (benchmark existing vs new implementation)
- [ ] Documentation updated with eviction policy

## Work Log

### 2026-02-14

- Identified in PR #73 full code review

## Resources

- PR #73: https://github.com/zone17/sovren/pull/73
- TTLCache file: `packages/backend/src/utils/ttl-cache.ts`
- Related: Health metrics using cache.size in monitoring endpoints
