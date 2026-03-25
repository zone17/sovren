---
status: pending
priority: p3
issue_id: 753
tags: [code-review, slice-8, types, notifications, typesafety]
dependencies: []
---

# P3: Notification data field opaque typing

## Problem Statement

The `data` field in notifications is typed as `Record<string, unknown>`, which is opaque and loses type safety. Different notification types carry different contextual data (e.g., circle notifications have circle_id, mention notifications have mention context), but the type system doesn't enforce or document this shape. This leads to unsafe data access and makes the notification type system brittle.

## Findings

- File: `packages/shared/src/types/notifications.ts`
- Current type: `data: Record<string, unknown>`
- Problem: No compile-time guarantee of data shape per notification type
- Risk: Frontend code accessing `data.circle_id` without knowing if it exists
- Better: Discriminated union type per notification entity_type

## Proposed Solutions

Create typed discriminated union:

```typescript
export type NotificationData =
  | CircleNotificationData
  | MentorshipNotificationData
  | FollowNotificationData
  | ContentNotificationData
  | SystemNotificationData;

export interface CircleNotificationData {
  type: 'circle';
  circle_id: string;
  circle_name: string;
}

export interface MentorshipNotificationData {
  type: 'mentorship';
  mentorship_id: string;
  mentor_name: string;
}

export interface FollowNotificationData {
  type: 'follow';
  follower_id: string;
  follower_name: string;
}

export interface ContentNotificationData {
  type: 'content';
  content_id: string;
  content_title: string;
}

export interface SystemNotificationData {
  type: 'system';
  [key: string]: unknown;
}

export interface Notification {
  id: string;
  user_id: string;
  entity_type: 'circle' | 'mentorship' | 'follow' | 'content' | 'system';
  data: NotificationData;
  read_at?: string;
  created_at: string;
}
```

## Technical Details

- Use discriminated union pattern: `data.type` narrows to correct interface
- Frontend can safely access `data.circle_id` when `entity_type === 'circle'`
- Provides compile-time type checking and IDE autocomplete
- Database stores JSON; type narrowing happens at runtime after deserialization

## Acceptance Criteria

- [ ] `NotificationData` discriminated union type created
- [ ] 5 sub-interfaces defined (one per entity_type)
- [ ] `Notification` interface updated to use `NotificationData`
- [ ] All frontend code updated to narrow types properly
- [ ] Backend serialization validates data shape matches entity_type
- [ ] Tests cover data shape validation per notification type
- [ ] Type safety verified with strict TypeScript config
