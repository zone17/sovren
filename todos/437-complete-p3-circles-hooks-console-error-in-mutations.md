---
id: 437
severity: P3
status: complete
title: 'useCircles hooks: console.error in onError callbacks should use logger or error boundary'
file: packages/frontend/src/features/creator-network/hooks/useCircles.ts
found_in: PR #89
reviewer: review-frontend
---

# Circles hooks use console.error instead of structured error handling

## Problem

Every mutation hook in `useCircles.ts` has an `onError` callback that calls `console.error`:

```typescript
onError: (error) => {
  console.error('Create circle failed:', error);
},
```

This pattern appears in:

- `useCreateCircle` (line 40)
- `useJoinCircle` (line 54)
- `useRemoveMember` (line 69)
- `usePostToCircle` (line 95)

And also in `useCollaboration.ts`:

- `useInviteCollaborators` (line 39)
- `useUpdateRevenueSplit` (line 76)
- `useRespondToCollaboration` (line 94)

Problems:

1. `console.error` is caught by the anti-pattern scanner for backend code (but frontend is excluded). However, best practice is to use a toast notification or error boundary.
2. No user-facing feedback — the error is only visible in DevTools
3. No structured error reporting (no Sentry capture, no analytics)

## Location

```
packages/frontend/src/features/creator-network/hooks/useCircles.ts  lines 40, 54, 69, 95
packages/frontend/src/features/creator-network/hooks/useCollaboration.ts  lines 39, 76, 94
```

## Fix

Either:

1. Use a toast notification service (e.g., `react-hot-toast`, `sonner`) for user-facing feedback
2. Or use a centralized error handler that also reports to Sentry:

```typescript
import { captureException } from '@sentry/react';
import { toast } from 'react-hot-toast';

onError: (error) => {
  captureException(error);
  toast.error('Failed to create circle. Please try again.');
},
```

## Severity Justification

P3: UX improvement. Users get no visible feedback when mutations fail.
