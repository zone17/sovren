# 173 - P1 - Bull Board Admin UI Has No Authentication Middleware

## Priority: P1 (Critical)

## Source

PR #83 — Review Agent: security-sentinel

## Description

The `/admin/queues` Bull Board endpoint is mounted in `server.ts` via `mountBullBoard(app, queueService)` without any authentication or authorization middleware. The `createBullBoardRouter()` function in `routes/admin/bull-board.ts` returns a raw Express router with no guards.

This means **any unauthenticated user** can:

- View all queue names and job data (including notification payloads with user IDs, content, etc.)
- See queue metrics, failure rates, and processing latency
- Retry or remove jobs from the Bull Board UI
- Inspect dead-letter queue contents

ADR-022 explicitly states: "Bull Board route protected by existing admin auth middleware (`requireAdmin`)" — but this was not implemented.

## Files

- `packages/backend/src/routes/admin/bull-board.ts` (no auth middleware applied)
- `packages/backend/src/app.ts:315-317` (`mountBullBoard` function)
- `packages/backend/src/server.ts:73-75` (mount point)

## Fix

Add `authenticate` and `authorize(['admin'])` middleware before the Bull Board router:

```typescript
// In app.ts mountBullBoard() or in server.ts
import { authenticate, authorize } from './middleware/auth';

app.use('/admin/queues', authenticate, authorize(['admin']), adminRouter);
```

## Impact

Security — unauthenticated access to admin functionality and sensitive queue data.
