---
id: 458
severity: P3
status: complete
title: 'wellness /benchmark endpoint: add comment explaining intentional omission of requireCreator'
file: packages/backend/src/routes/v2/wellness.routes.ts
found_in: PR #92
reviewer: review-security, review-architecture
---

# Benchmark endpoint missing comment about requireCreator omission

## Problem

All other wellness routes use `authenticate` + `requireCreator`. The `/benchmark` endpoint uses only `authenticate` without `requireCreator`, which is intentional (benchmarks are anonymous aggregate data accessible to all authenticated users), but the inconsistency isn't documented.

## Location

```
packages/backend/src/routes/v2/wellness.routes.ts  line 218
```

## Fix

```typescript
router.get(
  '/benchmark',
  authenticate,          // All authenticated users can view aggregate benchmarks
  // requireCreator intentionally omitted: benchmarks are anonymous community data
  expensiveRateLimiter,
```

## Severity Justification

P3: Code clarity. Without the comment, a future developer may add requireCreator thinking it was accidentally omitted.
