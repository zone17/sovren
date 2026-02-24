---
status: complete
priority: p2
issue_id: 491
tags: [code-review, duplication, nostr, architecture]
dependencies: []
---

# Signature message format duplicated in 5 locations

## Problem Statement

The NOSTR auth signature message format `Sovren Authentication\nChallenge: ${challenge}\nTimestamp: ${timestamp}` is duplicated across 5 files. If the format changes on the backend, all locations must update in lockstep or auth silently breaks.

## Findings

| #   | File                                                  | Line | Context                     |
| --- | ----------------------------------------------------- | ---- | --------------------------- |
| 1   | `packages/backend/src/services/nostr-auth.ts`         | 363  | Private method (canonical)  |
| 2   | `packages/backend/src/services/nostr-auth.ts`         | 462  | Exported standalone utility |
| 3   | `packages/frontend/e2e/helpers/nostr-auth.ts`         | 26   | E2E helper                  |
| 4   | `packages/frontend/src/contexts/NostrAuthContext.tsx` | 168  | Key-based login             |
| 5   | `packages/frontend/src/contexts/NostrAuthContext.tsx` | 261  | Extension-based login       |

## Proposed Solutions

### Option A: Move to shared package (Recommended)

Move `createSignatureMessage()` to `packages/shared/` so both frontend and backend import from single source.

- **Effort:** Medium (30 min)

### Option B: Add comment cross-references

Add `// MUST match: packages/backend/src/services/nostr-auth.ts:363` comments at each location.

- **Effort:** Small (10 min)
- **Risk:** Comments go stale

## Acceptance Criteria

- [ ] Single source of truth for signature message format
- [ ] Frontend and backend import from same location

## Work Log

| Date       | Action                                                                          | Learnings                                       |
| ---------- | ------------------------------------------------------------------------------- | ----------------------------------------------- |
| 2026-02-24 | Created from /workflows:review                                                  | Pattern recognition agent found all 5 instances |
| 2026-02-24 | Fixed: Option A — moved to @shared/types/nostr/auth.ts, all 5 locations updated | Single source of truth                          |
