---
status: pending
priority: p2
issue_id: '143'
tags:
  - code-review
  - round-7
  - security
  - auth
  - nostr
dependencies: []
---

# 143: NOSTR Signature 5-Minute Replay Window

## Problem Statement

NOSTR authentication signatures are valid for a 5-minute window. During this window, a captured signature can be replayed by an attacker to authenticate as the victim. There is no nonce tracking or signature-use-once enforcement.

**Why it matters**: An attacker who intercepts a NOSTR auth signature (via MITM, server log exposure, or shared network) can impersonate the user for up to 5 minutes.

## Findings

**Security Sentinel (Round 7)**: Flagged as P2 — NOSTR replay window allows signature reuse.

**Location**: `packages/backend/src/services/nostr-auth.ts` — timestamp validation allows +-5 minutes but doesn't track used signatures.

## Proposed Solutions

### Option A: Nonce Tracking with TTL Store (Recommended)
**Effort**: Medium | **Risk**: Low

Track used signature hashes in a TTL store (Map with 5-min TTL or Redis SET with EXPIRE). Reject any signature that has been used before.

```typescript
private usedNonces = new TTLCache<string, true>({ ttl: 5 * 60 * 1000 });

verifySignature(sig: string, ...): boolean {
  if (this.usedNonces.has(sig)) throw new Error('Signature already used');
  // ... verify signature
  this.usedNonces.set(sig, true);
  return true;
}
```

**Pros**: Prevents all replay attacks within the window
**Cons**: Small memory overhead (~100 bytes per auth, cleaned by TTL)

### Option B: Reduce Window to 30 Seconds
**Effort**: Small | **Risk**: Medium

Tighten the timestamp tolerance from 5 minutes to 30 seconds.

**Pros**: Smaller replay window
**Cons**: Clock drift issues, doesn't eliminate replay risk entirely

## Recommended Action

Option A — nonce tracking eliminates replay attacks entirely.

## Technical Details

**Affected Files**:
- `packages/backend/src/services/nostr-auth.ts`

## Acceptance Criteria

- [ ] Used signatures are tracked in TTL cache
- [ ] Replayed signature returns 401 Unauthorized
- [ ] TTL matches the timestamp window (signatures expire from tracking after window closes)
- [ ] Test: same signature used twice within 5 minutes returns 401 on second use

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-15 | Created from Round 7 security review | Signature-based auth needs replay protection |
