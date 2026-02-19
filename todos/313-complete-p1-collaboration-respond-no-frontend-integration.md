---
status: complete
priority: p1
issue_id: 313
tags: [code-review, frontend, agent-native]
---

# Collaboration respond has no frontend integration (finding #266 half-fix)

## Problem Statement

The backend route for responding to collaboration invitations exists, but there is no frontend API method, React hook, or UI component to accept or decline invitations. Users and agents have no way to respond to collaboration invitations.

## Findings

- `packages/backend/src/routes/v2/collaboration.routes.ts` line 103: backend route exists for responding to invitations
- `packages/frontend/src/features/creator-network/services/collaborationApi.ts`: missing `respondToInvitation` method
- No React hook for responding to collaboration invitations
- No UI component with accept/decline buttons
- This is a half-fix of finding #266 — the backend was implemented but frontend was not

## Proposed Solutions

1. Add API method to `collaborationApi.ts`:

```typescript
export const respondToInvitation = (invitationId: string, response: 'accepted' | 'declined') =>
  api.post(`/content/collaborate/${invitationId}/respond`, { response });
```

2. Add React hook `useRespondToCollaboration`:

```typescript
export const useRespondToCollaboration = () => {
  return useMutation({
    mutationFn: ({
      invitationId,
      response,
    }: {
      invitationId: string;
      response: 'accepted' | 'declined';
    }) => respondToInvitation(invitationId, response),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborations'] });
    },
  });
};
```

3. Add accept/decline UI component in the collaboration notifications/inbox area

## Technical Details

- **Affected Files**:
  - `packages/frontend/src/features/creator-network/services/collaborationApi.ts`
  - New hook file in `packages/frontend/src/features/creator-network/hooks/`
  - Collaboration inbox/notification UI component
- **Components**: Collaboration invitation response flow, Creator Network frontend

## Acceptance Criteria

- [ ] `respondToInvitation` method exists in collaborationApi.ts
- [ ] `useRespondToCollaboration` hook is available
- [ ] Users can accept/decline collaboration invitations via UI
