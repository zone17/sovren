---
status: pending
priority: p2
issue_id: '712'
tags: [code-review, frontend, dead-code, slice-8]
dependencies: []
---

# NotificationBadge.tsx exported but never used

## Problem Statement

`NotificationBadge.tsx` (41 LOC) in `packages/frontend/src/features/notifications/components/` is exported but never imported anywhere. The `UnifiedNotificationCenter` component renders its own badge inline instead of using this component.

**Agent consensus: 2/9** (Simplicity, Pattern)

## Fix

Delete `packages/frontend/src/features/notifications/components/NotificationBadge.tsx` and remove any barrel export references to it (e.g., in `index.ts`).
