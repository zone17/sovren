---
status: pending
priority: p1
issue_id: '609'
tags: [code-review, security, nostr, content-shield]
dependencies: []
---

# P1: NOSTR Event Verification Mismatch — Backend vs Frontend

## Problem Statement

The backend `ProvenanceService.signContent()` constructs a NOSTR event for verification that differs from what the frontend actually signs. Three mismatches cause `verifyEvent()` to ALWAYS return `false`:

1. **`created_at`**: Server uses `Math.floor(Date.now() / 1000)` (server time), client signs at client time. Network round-trip makes these differ.
2. **`tags`**: Frontend signs with `[['t', 'sovren-content']]`, backend reconstructs with `[]`.
3. **`content`**: Frontend signs raw content body, backend hashes content with SHA-256 and uses the hex digest.

This means every legitimately signed provenance record is stored as `unverified`, defeating the entire purpose of cryptographic provenance verification.

## Findings

- **Kieran TS Reviewer (P1-3)**: "Three mismatches: created_at, tags, content. verifyEvent() will return false for every legitimately signed event."
- **Consensus**: 1/5 agents flagged this (only Kieran read the backend code), but it's the most critical finding.

## Evidence

Frontend event (`usePublishWithProvenance.ts:32-37`):

```typescript
const eventTemplate: EventTemplate = {
  kind: 1,
  created_at: Math.floor(Date.now() / 1000),
  tags: [['t', 'sovren-content']],
  content, // raw content body
};
```

Backend verification event (`ProvenanceService.ts:125-138`):

```typescript
const eventData = {
  kind: 1,
  pubkey: input.creatorId,
  created_at: Math.floor(Date.now() / 1000), // different timestamp
  tags: [] as string[][], // empty tags
  content: contentHash, // SHA-256 hex digest
};
```

## Proposed Solutions

### Option A: Pass signed event details from frontend to backend (Recommended)

Frontend sends the full event (kind, created_at, tags, content) alongside the signature. Backend reconstructs the exact same event for verification.

- Pros: Verification actually works; frontend controls event shape
- Cons: Larger request payload; need to validate event fields
- Effort: Medium
- Risk: Low

### Option B: Backend stores the raw signature without verification, defer verification to read-time

Backend accepts the signature and event ID, stores them, and verifies lazily when provenance is queried.

- Pros: Simpler write path
- Cons: Defers a security check; still need event details eventually
- Effort: Small
- Risk: Medium (security gap)

## Recommended Action

Option A — the frontend must send the event details (or the full unsigned event) to the backend so verification uses the exact same inputs.

## Technical Details

**Affected files:**

- `packages/backend/src/services/provenance/ProvenanceService.ts` (lines 125-138)
- `packages/frontend/src/features/content-shield/hooks/usePublishWithProvenance.ts` (lines 32-37)
- `packages/frontend/src/features/content-shield/services/shieldApi.ts` (SignProvenanceBody)
- `packages/backend/src/validators/shield.ts` (SignProvenanceBodySchema)

## Acceptance Criteria

- [ ] `verifyEvent()` returns `true` for validly signed events
- [ ] Backend and frontend use identical event structure for signing/verification
- [ ] Unit test covers verification success and failure paths
- [ ] ProvenanceService.test.ts updated with matching event data

## Work Log

| Date       | Action                      | Learnings                                                        |
| ---------- | --------------------------- | ---------------------------------------------------------------- |
| 2026-03-03 | Created from PR #132 review | Kieran TS reviewer caught this — backend/frontend event mismatch |

## Resources

- PR #132: https://github.com/zone17/sovren/pull/132
- critical-patterns.md #9: NOSTR verifyEvent requires computed ID
