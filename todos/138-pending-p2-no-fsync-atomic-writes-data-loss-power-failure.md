---
status: pending
priority: p2
issue_id: '138'
tags:
  - code-review
  - round-7
  - data-integrity
  - persistence
  - payment
dependencies: []
---

# 138: No fsync() in Atomic Write Pattern — Data Loss on Power Failure

## Problem Statement

The temp+rename atomic write pattern in `payment-persistence.ts` and `receipt-service.ts` uses `writeFileSync` followed by `renameSync`, but never calls `fsync()` on the file descriptor before renaming. On Linux/macOS, `writeFileSync` writes to the kernel buffer cache — if power fails before the buffer is flushed to disk, the temp file contains zero bytes, and the rename atomically replaces the target with an empty file.

**Why it matters**: The atomic write pattern is incomplete. Data can still be lost on ungraceful shutdown (power failure, OOM kill, kernel panic).

## Findings

**Data Integrity Guardian (Round 7)**: Flagged as CRITICAL — fsync() missing voids atomic write guarantee on power failure.

**Locations**:
- `packages/backend/src/services/payment-persistence.ts:~70-80` — `doWrite()` method
- `packages/backend/src/services/lightning/receipt-service.ts:~200-210` — `ReceiptPersistence.doWrite()`

## Proposed Solutions

### Option A: Add fsync Before Rename (Recommended)
**Effort**: Small | **Risk**: Low

```typescript
import { openSync, writeSync, fsyncSync, closeSync, renameSync } from 'fs';

private doWrite(type: 'invoices' | 'payments'): void {
  const filePath = path.join(this.dataDir, `${type}.json`);
  const tmpPath = `${filePath}.tmp`;
  const fd = openSync(tmpPath, 'w');
  writeSync(fd, JSON.stringify(data, null, 2));
  fsyncSync(fd); // Flush to disk before rename
  closeSync(fd);
  renameSync(tmpPath, filePath);
}
```

**Pros**: Complete atomic write guarantee, industry standard
**Cons**: Slightly slower writes (~1-5ms per fsync)

### Option B: Accept Risk, Document Limitation
**Effort**: None | **Risk**: High

Document that the file store is not crash-safe on power failure and rely on hourly backups.

**Pros**: No code change
**Cons**: Data loss window of up to 1 hour

## Recommended Action

Option A — fsync is a one-line addition that completes the atomic write contract.

## Technical Details

**Affected Files**:
- `packages/backend/src/services/payment-persistence.ts`
- `packages/backend/src/services/lightning/receipt-service.ts`

## Acceptance Criteria

- [ ] `fsyncSync(fd)` (or async `fsync`) called on file descriptor before `rename`
- [ ] Both `payment-persistence.ts` and `receipt-service.ts` updated
- [ ] Write path uses `open` + `write` + `fsync` + `close` + `rename` sequence
- [ ] Unit test: verify fsync is called before rename (mock fs operations)

**Note**: Coordinate with todo 140 (async I/O migration). Final write path should use async fsync via `fileHandle.sync()`.

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-15 | Created from Round 7 data integrity review | Atomic writes need fsync to be truly atomic |
