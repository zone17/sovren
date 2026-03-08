---
status: pending
priority: p3
issue_id: '719'
tags: [code-review, frontend, react-query, slice-8]
dependencies: []
---

# Client-side unread count vs hook

## Problem Statement

`ServerNotificationCenter.tsx` computes the unread notification count from the currently loaded page (max 20 items) instead of using the dedicated `useUnreadNotificationCount` hook. This means the badge count is inaccurate if there are more than 20 unread notifications.

**Agent consensus: 1/9** (Pattern)

## Fix

In `packages/frontend/src/features/notifications/components/ServerNotificationCenter.tsx`, replace the inline unread count computation with `useUnreadNotificationCount()` hook. This provides the accurate total unread count from the server rather than counting from the first page of results.
