---
status: complete
priority: p1
issue_id: 312
tags: [code-review, frontend-backend, api-contract]
---

# Frontend-backend shape mismatch — collaboration invite

## Problem Statement

The frontend sends an array-based shape `{ contentId, collaborators: [{ creatorId, revenueSplitBps }] }` but the backend expects a flat single-collaborator shape `{ contentId, collaboratorId, revenueSplitBps }`. Every `POST /content/collaborate` request will fail with a 400 validation error because `collaboratorId` is missing.

## Findings

- `packages/frontend/src/features/creator-network/services/collaborationApi.ts` lines 10-12: sends `{ contentId, collaborators: [{ creatorId, revenueSplitBps }] }` (array of collaborators)
- `packages/backend/src/validators/community.ts` lines 59-63: expects `{ contentId, collaboratorId, revenueSplitBps }` (flat, single collaborator)
- The structural mismatch means `collaboratorId` is never present in the request body
- Collaboration invitations are completely broken

## Proposed Solutions

1. **Option A** — Update frontend to send flat shape per collaborator (simpler, matches current backend):

```typescript
// Before
const inviteCollaborators = (data: {
  contentId: string;
  collaborators: Array<{ creatorId: string; revenueSplitBps: number }>;
}) => api.post('/content/collaborate', data);

// After — send one request per collaborator
const inviteCollaborator = (data: {
  contentId: string;
  collaboratorId: string;
  revenueSplitBps: number;
}) => api.post('/content/collaborate', data);
```

2. **Option B** — Update backend to accept array (more flexible, but larger change):

```typescript
const collaborateSchema = z.object({
  contentId: z.string().uuid(),
  collaborators: z.array(
    z.object({
      collaboratorId: z.string().uuid(),
      revenueSplitBps: z.number().int().min(0).max(10000),
    })
  ),
});
```

## Technical Details

- **Affected Files**:
  - `packages/frontend/src/features/creator-network/services/collaborationApi.ts`
  - `packages/backend/src/validators/community.ts`
  - Components calling `inviteCollaborators`
- **Components**: Collaboration invite flow, Creator Network UI

## Acceptance Criteria

- [ ] Frontend request shape matches backend Zod schema
- [ ] `POST /content/collaborate` requests succeed without 400 errors
