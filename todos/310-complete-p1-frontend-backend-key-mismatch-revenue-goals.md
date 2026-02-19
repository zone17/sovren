---
status: complete
priority: p1
issue_id: 310
tags: [code-review, frontend-backend, api-contract]
---

# Frontend-backend key mismatch — `targetDistribution` vs `targets` (revenue goals)

## Problem Statement

The frontend sends `{ targetDistribution }` but the backend Zod schema expects `{ targets }`. Every `PUT /business/revenue/goals` request will fail with a 400 validation error.

## Findings

- `packages/frontend/src/features/business/services/revenueApi.ts` line 28: sends `{ targetDistribution }`
- `packages/backend/src/validators/finance.ts` lines 106-108: expects `{ targets }`
- The key name mismatch causes Zod validation to reject every request
- Revenue goal updates are completely broken on the frontend

## Proposed Solutions

1. Rename the frontend key to match the backend schema:

```typescript
// Before (revenueApi.ts)
const updateRevenueGoals = (data: { targetDistribution: Distribution[] }) =>
  api.put('/business/revenue/goals', data);

// After
const updateRevenueGoals = (data: { targets: Distribution[] }) =>
  api.put('/business/revenue/goals', data);
```

Also update any components that call this function to use the `targets` key.

## Technical Details

- **Affected Files**:
  - `packages/frontend/src/features/business/services/revenueApi.ts`
  - Any components calling `updateRevenueGoals`
- **Components**: Revenue goals API integration, Business Manager UI

## Acceptance Criteria

- [ ] Frontend sends `{ targets }` matching backend Zod schema
- [ ] `PUT /business/revenue/goals` requests succeed without 400 errors
