---
status: pending
priority: p3
issue_id: '036'
tags: [code-review, quality, typescript]
dependencies: []
---

# Minor Code Quality Improvements

## Problem Statement

Collection of minor quality issues across the PR:

1. **Deprecated `substr`** in `GlobalErrorBoundary.tsx:63`, `FeatureErrorBoundary.tsx:73,90`: Use `substring(2, 11)` instead.

2. **Inline `require('crypto')`** in `security-headers.ts:210`: Use top-level import.

3. **Inline `require('os')`** in `health.ts:397`: Use top-level import.

4. **Default exports alongside named exports** in `csrf.ts`, `rate-limit-middleware.ts`, `frontend/sentry.ts`: Project mandates named imports over default exports.

5. **`collectDefaultMetrics` side effect** at import time in `deployment-monitoring.ts:22-25`: Causes "metric already registered" in tests.

6. **Swallowed error** in `deployment-monitoring.ts:207`: Caught error silently discarded.

7. **`sentryErrorHandler` exported but unused** in `sentry.ts:77-79`: Dead export with fragile conditional.

8. **Rate limiter bypass not timing-safe** (`rate-limit-middleware.ts:278-279`): Uses `===` instead of `crypto.timingSafeEqual`.

9. **`console.*` instead of structured logger** in `security-headers.ts` (30+ occurrences) and `deployment-monitoring.ts:219-269`.

## Findings

- **kieran-typescript-reviewer**: LOW-21 through LOW-25, MEDIUM-14 through MEDIUM-17
- **security-sentinel**: MEDIUM-08, LOW-01
- **performance-oracle**: CRITICAL-2 (require inline)

## Proposed Solutions

Apply each fix individually. All are small, isolated changes.

**Effort**: Small per item | **Risk**: None

## Acceptance Criteria

- [ ] No deprecated `substr` usage
- [ ] No inline `require()` in TypeScript files
- [ ] No default exports in new code
- [ ] `collectDefaultMetrics` gated by initialization function
