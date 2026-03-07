---
status: pending
priority: p2
issue_id: '690'
tags: [code-review, frontend, ux, slice-8]
dependencies: []
---

# groupByDate uses UTC midnight — wrong Today/Yesterday for non-UTC users

## Problem Statement

`ServerNotificationCenter.tsx:23` computes `todayStart = now - (now % DAY)` which is UTC midnight. A user in UTC-5 at 23:00 local sees last-hour notifications as "Yesterday".

**Agent consensus: 2/8** (Simplicity, TypeScript)

## Fix

```typescript
const d = new Date();
d.setHours(0, 0, 0, 0);
const todayStart = d.getTime();
```

## Acceptance Criteria

- [ ] "Today"/"Yesterday" grouping uses local midnight, not UTC
