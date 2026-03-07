---
status: pending
priority: p2
issue_id: "694"
tags: [code-review, frontend, backend, ux, slice-8]
dependencies: []
---

# console.error without toast in 8+ hooks + leaveCircle missing membership check

## Problem Statement

Two UX/data-integrity issues:
1. 8+ mutation `onError` handlers in marketplace/collaboration/mentorship hooks only `console.error` — no user feedback. Established pattern uses `toast.error()`.
2. `CreatorCircleService.leaveCircle()` doesn't verify membership exists before DELETE — non-member gets success. No event emitted on leave.

**Agent consensus: 1/8 each** (Simplicity, Data Integrity)

## Fix

### console.error → toast.error
Replace `console.error(...)` with `toast.error(error.message || 'Operation failed')` in:
- `useMarketplace.ts` (6 locations)
- `useCollaboration.ts` (3 locations)
- `useMentorship.ts` (2 locations)

### leaveCircle
Add membership existence check before DELETE. Log warning on not-found.

## Acceptance Criteria

- [ ] All mutation error handlers show user-visible toast
- [ ] `leaveCircle()` checks membership before deleting
