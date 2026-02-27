---
status: complete
priority: p1
issue_id: '540'
tags: [code-review, performance, test-infrastructure, pr-102]
dependencies: []
---

# P1: Aggregation test uses real 5.1s setTimeout — 91% of suite runtime

## Problem Statement

`PaymentAnalyticsService.test.ts` "should complete aggregation job" test waits for a real `setTimeout(5100)` to verify aggregation completion. This single test accounts for 5.1s of the 5.6s total suite runtime (91%). The source service uses `setTimeout(5000)` for job completion simulation with no way to clear the handle.

## Findings

**Agent consensus: 1/8 agents (Performance Oracle P1) — clear perf impact**

### Current test code:

```typescript
// Wait for aggregation to complete (5 second timeout in service)
await new Promise((resolve) => setTimeout(resolve, 5100));
expect(status?.status).toBe('completed');
```

### Source code (PaymentAnalyticsService.ts:1441):

```typescript
setTimeout(() => {
  this.aggregationJobs.set(jobId, { status: 'completed', progress: 100 });
}, 5000);
```

The `setTimeout` handle is not stored, so it cannot be cleared by `dispose()`.

## Proposed Solutions

### Solution A: Use vi.useFakeTimers() for this specific test (Recommended)

**Effort:** Small (15 min) | **Risk:** Low

```typescript
it('should complete aggregation job', async () => {
  vi.useFakeTimers();
  try {
    const jobId = await service.triggerAggregation({
      /* ... */
    });
    vi.advanceTimersByTime(5100);
    const status = await service.getAggregationStatus(jobId);
    expect(status?.status).toBe('completed');
  } finally {
    vi.useRealTimers();
  }
});
```

**Expected gain:** Suite drops from ~5.6s to ~0.5s (10x faster).

### Solution B: Accept the 5.1s cost

**Effort:** None | **Risk:** None

Current approach works. Suite completes in 5.6s which is acceptable.

## Acceptance Criteria

- [ ] Aggregation test passes without 5.1s wall-clock delay
- [ ] All 317 tests still pass
- [ ] Suite runtime < 1s (excluding network-dependent tests)

## Technical Details

**Affected files:**

- `packages/backend/src/services/payment/__tests__/PaymentAnalyticsService.test.ts` (~line 1182)

## Resources

- Performance Oracle: Finding #2
