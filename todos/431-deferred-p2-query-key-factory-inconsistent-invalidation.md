---
id: 431
severity: P2
status: deferred
title: "useRespondToCollaboration invalidates all collaborator queries (overbroad)"
file: packages/frontend/src/features/creator-network/hooks/useCollaboration.ts
found_in: PR #89
reviewer: review-frontend
---

# useRespondToCollaboration uses overbroad cache invalidation

## Problem

The `useRespondToCollaboration` hook invalidates ALL collaborator queries on success:

```typescript
onSuccess: () => {
  // Invalidates all collaborator queries -- contentId unknown from invitation response
  queryClient.invalidateQueries({ queryKey: [...collaboratorKeys.all] });
},
```

The comment acknowledges the issue ("contentId unknown from invitation response"), but the fix should be to return the contentId from the API response and invalidate precisely. Invalidating `collaboratorKeys.all` will:

1. Refetch collaborator data for ALL content items, not just the one affected
2. Cause unnecessary network requests on every invitation response
3. Degrade perceived performance when the user has many collaboration relationships

This is the exact overbroad invalidation pattern that the query key factories were designed to fix (per the PR description).

## Location

```
packages/frontend/src/features/creator-network/hooks/useCollaboration.ts  line 91
```

## Fix

Have the backend `respondToInvitation` API return the `contentId` in its response, then invalidate precisely:

```typescript
export function useRespondToCollaboration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ invitationId, accept }: { invitationId: string; accept: boolean }) =>
      collaborationApi.respondToInvitation(invitationId, accept),
    onSuccess: (response) => {
      // Precise invalidation using the contentId from the API response
      if (response.data?.contentId) {
        queryClient.invalidateQueries({
          queryKey: collaboratorKeys.detail(response.data.contentId),
        });
      } else {
        // Fallback to broad invalidation if contentId not returned
        queryClient.invalidateQueries({ queryKey: collaboratorKeys.all });
      }
    },
  });
}
```

## Severity Justification

P2: Performance issue. The query key factory pattern was introduced in this PR specifically to enable precise invalidation. This hook undermines that pattern.
