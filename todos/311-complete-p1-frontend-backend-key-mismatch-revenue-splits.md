---
status: complete
priority: p1
issue_id: 311
tags: [code-review, frontend-backend, api-contract]
---

# Frontend-backend key mismatch — `revenueSplitBps` vs `bps` (revenue splits)

## Problem Statement

The frontend sends `{ splits: [{ creatorId, revenueSplitBps }] }` but the backend Zod schema expects `{ splits: [{ creatorId, bps }] }`. Every `PUT /content/:id/revenue-split` request will fail with a 400 validation error.

## Findings

- `packages/frontend/src/features/creator-network/services/collaborationApi.ts` line 17: sends `{ splits: [{ creatorId, revenueSplitBps }] }`
- `packages/backend/src/validators/community.ts` lines 72-75: expects `{ splits: [{ creatorId, bps }] }`
- The key name mismatch (`revenueSplitBps` vs `bps`) causes Zod validation to reject every request
- Revenue split updates are completely broken

## Proposed Solutions

1. Rename the frontend key to match the backend schema:

```typescript
// Before (collaborationApi.ts)
splits: collaborators.map((c) => ({
  creatorId: c.creatorId,
  revenueSplitBps: c.revenueSplitBps,
}));

// After
splits: collaborators.map((c) => ({
  creatorId: c.creatorId,
  bps: c.revenueSplitBps,
}));
```

## Technical Details

- **Affected Files**:
  - `packages/frontend/src/features/creator-network/services/collaborationApi.ts`
  - Any components providing data to this API call
- **Components**: Revenue split API integration, Creator Network collaboration UI

## Acceptance Criteria

- [ ] Frontend sends `bps` matching backend Zod schema
- [ ] `PUT /content/:id/revenue-split` requests succeed without 400 errors
