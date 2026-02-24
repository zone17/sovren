---
status: complete
priority: p1
issue_id: 488
tags: [code-review, security, nostr, correctness]
dependencies: []
---

# `isValidSignature` utility still uses `id: ''` — always returns false

## Problem Statement

The commit `68a92d3` correctly fixed `NostrAuthService.verifySignature()` (line 166-177) to compute the NOSTR event ID via `getEventHash(eventData)`. However, the standalone exported utility `isValidSignature()` at lines 469-492 of the same file was **not updated** and still uses `id: ''`.

`verifyEvent()` from `nostr-tools/pure` does NOT compute the ID — it validates that `id` matches the hash of the event contents. Passing `id: ''` means verification **always fails**.

**Agent consensus:** 9 of 10 review agents flagged this independently. Strongest signal in the review.

## Findings

- **File:** `packages/backend/src/services/nostr-auth.ts`, lines 469-492
- **Current blast radius:** Zero — grep confirms no code imports `isValidSignature`
- **Risk:** Latent trap for any future caller. Exported public API that silently fails.
- **Git history:** The `id: ''` pattern was present since the file's creation (Oct 2025) and survived 2 nostr-tools migrations and 139 review findings.

## Proposed Solutions

### Option A: Apply the same `getEventHash` fix (Recommended)

```typescript
const eventData: UnsignedEvent = {
  kind: 1,
  pubkey,
  created_at: Math.floor(Date.now() / 1000),
  tags: [],
  content: messageHash,
};
const event: NostrEvent = {
  ...eventData,
  id: getEventHash(eventData),
  sig: signature,
};
```

- **Effort:** Small (5 min)
- **Risk:** None — same pattern already applied 300 lines above

### Option B: Delete the function entirely

The function is unused and duplicates `verifySignature()`. Removing it eliminates dead code.

- **Effort:** Small (2 min)
- **Risk:** Low — no callers exist

## Recommended Action

Option A if anyone might need the utility. Option B if DRY is preferred.

## Technical Details

- **Affected files:** `packages/backend/src/services/nostr-auth.ts`

## Acceptance Criteria

- [ ] `isValidSignature` uses `getEventHash(eventData)` instead of `id: ''`, OR is deleted
- [ ] No `id: ''` pattern remains in `nostr-auth.ts`

## Work Log

| Date       | Action                                                 | Learnings                           |
| ---------- | ------------------------------------------------------ | ----------------------------------- |
| 2026-02-24 | Created from /workflows:review (10-agent parallel)     | 9/10 agent consensus = confirmed P1 |
| 2026-02-24 | Fixed with Option A, committed 88b401d, pushed to main | getEventHash pattern applied        |
