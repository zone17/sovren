---
status: pending
priority: p2
issue_id: '140'
tags:
  - code-review
  - round-7
  - performance
  - persistence
  - payment
dependencies: []
---

# 140: Blocking Sync I/O in Persistence Layer — Event Loop Blocked

## Problem Statement

`payment-persistence.ts` and `receipt-service.ts` use `writeFileSync`, `renameSync`, and `readFileSync` for all file operations. These are synchronous operations that block the Node.js event loop. For a production backend handling concurrent requests, blocking I/O causes request queuing, increased latency, and potential timeout failures.

**Why it matters**: A single large `invoices.json` write (e.g., 10K invoices = ~2MB JSON) blocks the event loop for 5-50ms, during which no other requests can be processed.

## Findings

**Performance Oracle (Round 7)**: Flagged as CRITICAL — blocking sync I/O in hot path.

**Locations**:
- `packages/backend/src/services/payment-persistence.ts` — `doWrite()` uses `writeFileSync` + `renameSync`
- `packages/backend/src/services/lightning/receipt-service.ts` — `ReceiptPersistence` uses `writeFileSync` + `renameSync`
- Both persistence classes use `readFileSync` on startup

## Proposed Solutions

### Option A: Async I/O with Worker Thread (Recommended)
**Effort**: Medium | **Risk**: Low

Move file writes to async operations. Use `fs.promises.writeFile` + `fs.promises.rename`. The write mutex already serializes writes, so async is safe.

```typescript
import { writeFile, rename } from 'fs/promises';

private async doWrite(type: 'invoices' | 'payments'): Promise<void> {
  const tmpPath = `${filePath}.tmp`;
  await writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  await rename(tmpPath, filePath);
}
```

**Pros**: Non-blocking, simple migration from sync to async
**Cons**: Need to verify rename atomicity is preserved with async API (it is on POSIX)

### Option B: Keep Sync, Accept Limitation
**Effort**: None | **Risk**: High

Document that sync I/O is acceptable for current scale.

**Pros**: No change
**Cons**: Performance degrades as data grows

## Recommended Action

Option A — migrate from sync to async I/O. The write mutex already handles serialization.

## Technical Details

**Affected Files**:
- `packages/backend/src/services/payment-persistence.ts`
- `packages/backend/src/services/lightning/receipt-service.ts`

## Acceptance Criteria

- [ ] All file writes in `payment-persistence.ts` use async `fs/promises` API
- [ ] All file writes in `receipt-service.ts` use async `fs/promises` API
- [ ] Write mutex continues to serialize writes correctly with async operations
- [ ] Startup reads may remain sync (called once at init, before server listens)
- [ ] `doWrite()` method signature is `async` and returns `Promise<void>`
- [ ] Test: write mutex prevents concurrent writes (async version)

**Note**: Coordinate with todo 138 (fsync). Use async fsync via `fs.promises.open` + `fileHandle.sync()` + `fileHandle.close()`.

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-15 | Created from Round 7 performance review | Production backends must never use sync I/O in request paths |
