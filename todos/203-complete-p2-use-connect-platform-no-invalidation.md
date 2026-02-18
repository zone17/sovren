---
status: pending
priority: p2
issue_id: "203"
tags: [code-review, pr-85, frontend]
---

# useConnectPlatform Hook Missing Cache Invalidation

## Problem Statement
useConnectPlatform hook does not invalidate the 'platform-status' React Query cache after successful connection. UI shows stale disconnected state until manual refresh.

## Findings
- **File**: `packages/frontend/src/features/multi-platform/hooks/useConnectPlatform.ts` (or similar)
- The `useConnectPlatform` hook handles the OAuth connection flow for platforms
- After a successful connection, the hook does not call `queryClient.invalidateQueries` for the platform status cache
- The `platform-status` query (which shows connected/disconnected state per platform) continues to serve stale cached data
- Users see their platform as "disconnected" even after successful OAuth, until they manually refresh the page or the cache TTL expires
- This creates a confusing UX where the action appears to have failed

## Proposed Solutions
1. Add `queryClient.invalidateQueries(['platform-status'])` in the `onSuccess` callback of the connect mutation, forcing an immediate refetch of platform connection status
2. Additionally invalidate any related queries (e.g., `['platform-connections']`, `['connected-platforms']`) that may also display stale state

## Acceptance Criteria
- [ ] After successful platform connection, platform-status cache is invalidated immediately
- [ ] UI updates to show "connected" state without requiring manual page refresh
- [ ] Related queries (platform connections list, etc.) are also invalidated
- [ ] Disconnect flow similarly invalidates the cache (if not already handled)
