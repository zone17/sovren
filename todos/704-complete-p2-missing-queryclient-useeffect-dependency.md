---
status: pending
priority: p2
issue_id: '704'
tags: [code-review, frontend, react-query, slice-8]
dependencies: []
---

# Missing queryClient in useEffect dependency array

## Problem Statement

In the realtime subscription `useEffect` hook, `queryClient` is captured at mount time but not listed in the dependency array. If `QueryClientProvider` re-mounts (unlikely but possible in testing or layout changes), the subscription would use a stale `queryClient` reference, causing cache invalidations to target the wrong query client.

**Agent consensus: 5/9** (Security, Performance, Architecture, Pattern, TypeScript)

## Fix

In `packages/frontend/src/features/notifications/hooks/useNotifications.ts` at line 116, add `queryClient` to the `useEffect` dependency array. This ensures the subscription is re-created if the query client instance changes.
