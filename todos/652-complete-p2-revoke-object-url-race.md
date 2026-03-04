---
status: pending
priority: p2
issue_id: '652'
tags: [code-review, frontend, browser-api, business-manager]
dependencies: []
---

# URL.revokeObjectURL Called Synchronously After link.click()

## Problem Statement

In `TaxSummary.tsx`, `URL.revokeObjectURL(blobUrl)` is called synchronously after `link.click()`. For large files, the browser may not have captured the blob reference before revocation, causing a broken download.

**Consensus**: 3/8 review agents flagged this.

## Findings

- `packages/frontend/src/features/business/components/TaxSummary.tsx` — `link.click(); URL.revokeObjectURL(blobUrl);` on consecutive lines

## Proposed Solutions

### Solution A: Defer revocation with setTimeout (Recommended)

```typescript
link.click();
setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
```

- **Pros**: Simple, widely used pattern, gives browser time to capture blob
- **Cons**: 1s delay before memory cleanup (negligible)
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] URL.revokeObjectURL deferred by at least 1 second after click
- [ ] Large file exports download successfully
- [ ] No memory leak (blob is eventually revoked)

## Work Log

| Date       | Action                                            | Learnings                            |
| ---------- | ------------------------------------------------- | ------------------------------------ |
| 2026-03-04 | Created from PR #136 review (3/8 agent consensus) | Browser blob download race condition |
