---
status: pending
priority: p3
issue_id: 752
tags: [code-review, slice-8, notifications, frontend, ux]
dependencies: []
---

# P3: No useDeleteNotification hook or UI

## Problem Statement

Users cannot delete individual notifications; they can only mark them as read. This limits notification management UX. The backend needs a delete endpoint, and the frontend needs the corresponding hook and UI button to remove unwanted notifications.

## Findings

- Current behavior: Users can only read/unread notifications
- Missing: DELETE endpoint for notifications
- Missing: `useDeleteNotification()` React hook
- Missing: Delete button in notification UI
- Impact: Users cannot clean up their notification feed

## Proposed Solutions

1. **Backend endpoint**: Add DELETE handler

```typescript
// routes/v2/notifications/:id.ts
export async function DELETE(req: Request, { id }: { id: string }) {
  const userId = req.user.id;
  await db.from('notifications').delete().eq('id', id).eq('user_id', userId);
  return createApiResponse({ message: 'Notification deleted' });
}
```

2. **Frontend hook**: Create mutation hook

```typescript
export function useDeleteNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => apiClient.delete(`/notifications/${notificationId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
```

3. **UI**: Add delete button to notification item with confirmation

## Technical Details

- Verify ownership (user_id match) on DELETE to prevent unauthorized deletion
- Consider soft-delete if audit trail required, otherwise hard delete is fine
- Update notification query to exclude deleted items
- Add optimistic UI update or loading state during delete

## Acceptance Criteria

- [ ] DELETE `/api/v2/notifications/:id` endpoint implemented
- [ ] Endpoint validates user ownership before deletion
- [ ] `useDeleteNotification()` hook created and exported
- [ ] Delete button added to notification UI component
- [ ] Confirmation dialog shown before deletion
- [ ] Tests cover deletion flow (API, hook, UI integration)
- [ ] Query client invalidation on success
