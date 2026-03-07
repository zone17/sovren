---
id: 433
severity: P2
status: complete
title: 'Wellness benchmark endpoint: optionalAuth + expensive query = abuse vector'
file: packages/backend/src/routes/v2/wellness.routes.ts
found_in: PR #89
reviewer: review-security
---

# Wellness benchmark endpoint allows unauthenticated expensive queries

## Problem

The `/benchmark` endpoint uses `optionalAuth` (not `authenticate`) combined with `expensiveRateLimiter`:

```typescript
router.get(
  '/benchmark',
  optionalAuth, // <-- allows unauthenticated requests
  expensiveRateLimiter, // <-- 5 req/min per user... but unauthenticated users share one bucket?
  asyncHandler(async (req, res) => {
    const data = await getWellnessService().getBenchmark();
    // ...
  })
);
```

The rate limiter is `createUserRateLimiter` which likely keys on the user ID. For unauthenticated requests, all anonymous users may share the same rate limit key (null/undefined user), OR each gets their own key by IP. Either way:

1. **If keyed by userId:** All anonymous users share one bucket of 5 req/min. A single user can exhaust the quota for all anonymous users.
2. **If keyed by IP:** Each IP gets 5 req/min, but behind NAT/proxies many users share IPs.

The `getBenchmark()` call is described as expensive (anonymous aggregation of 10+ participants). This is an amplification vector.

## Location

```
packages/backend/src/routes/v2/wellness.routes.ts  lines 216-228
```

## Fix

Either:

1. Require authentication for the benchmark endpoint (change `optionalAuth` to `authenticate`)
2. Or add a stricter IP-based rate limiter specifically for anonymous benchmark requests:

```typescript
const anonymousBenchmarkLimiter = createRateLimiter({
  windowMs: 60000,
  max: 2,
  keyGenerator: (req) => req.ip || 'unknown',
});
```

## Severity Justification

P2: Denial-of-service vector. Anonymous expensive query without adequate rate limiting.
