---
status: complete
priority: p1
issue_id: 319
tags: [code-review, security, rate-limiting]
---

# Missing mutation rate limiter on all 4 EPIC-011 (Business Manager) route files

## Problem Statement

All four Business Manager route files apply `readOnlyRateLimiter` but no `mutationRateLimiter` on POST/PUT endpoints. EPIC-010 routes correctly have mutation rate limiting. An attacker can hit `POST /business/invoices` (triggers BullMQ job creation) or `POST /business/revenue` (triggers outbound CoinGecko API calls) at unlimited rate.

## Findings

- `packages/backend/src/routes/v2/business-contracts.routes.ts`: no `mutationRateLimiter` on POST/PUT
- `packages/backend/src/routes/v2/business-invoices.routes.ts`: no `mutationRateLimiter` on POST/PUT
- `packages/backend/src/routes/v2/business-revenue.routes.ts`: no `mutationRateLimiter` on POST/PUT
- `packages/backend/src/routes/v2/business-tax.routes.ts`: no `mutationRateLimiter` on POST/PUT
- EPIC-010 routes (marketplace, collaboration) correctly use `mutationRateLimiter` — pattern exists but was not applied
- POST /business/invoices triggers BullMQ job creation — unbounded invocation is a resource exhaustion vector
- POST /business/revenue makes outbound CoinGecko API calls — unbounded invocation risks upstream rate limiting

## Proposed Solutions

1. Add `mutationRateLimiter` to each file:

```typescript
import { createUserRateLimiter } from '../../middleware/rateLimiter';

const mutationRateLimiter = createUserRateLimiter({
  windowMs: 60000,
  max: 20,
});

// Apply to POST/PUT handlers
router.post('/invoices', mutationRateLimiter, async (req, res, next) => { ... });
router.put('/invoices/:id', mutationRateLimiter, async (req, res, next) => { ... });
```

Apply the same pattern across all four route files for all POST and PUT endpoints.

## Technical Details

- **Affected Files**:
  - `packages/backend/src/routes/v2/business-contracts.routes.ts`
  - `packages/backend/src/routes/v2/business-invoices.routes.ts`
  - `packages/backend/src/routes/v2/business-revenue.routes.ts`
  - `packages/backend/src/routes/v2/business-tax.routes.ts`
- **Components**: Business Manager route middleware, rate limiting

## Acceptance Criteria

- [ ] All finance POST/PUT endpoints have per-user mutation rate limiting
- [ ] Rate limiter config matches EPIC-010 pattern (60s window, 20 max)
