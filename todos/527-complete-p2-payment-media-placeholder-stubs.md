---
status: complete
priority: p2
issue_id: '527'
tags: [code-review, security, payments, media, content]
dependencies: []
---

# PremiumContentPaywall + MediaEmbedder: silent-success placeholder stubs

## Problem Statement

Two components replaced no-op Redux dispatches with placeholder logic that silently "succeeds" without performing real operations:

1. **PremiumContentPaywall**: `onPaymentComplete?.()` called immediately — users appear to pay but no payment occurs. (Old code dispatched a no-op `supportContent` stub, so behavior is unchanged, but the new code makes the gap more explicit.)

2. **MediaEmbedder**: `crypto.randomUUID()` generates fake `media_asset_id` + `setTimeout(500)` simulates upload — files appear uploaded but go nowhere.

**Consensus:** Security sentinel (P1), Data integrity (P1), 3 other agents (P2+). Reclassified to P2 because old behavior was equally no-op.

## Findings

- `PremiumContentPaywall.tsx:58-60` — `onPaymentComplete?.()` without payment API call
- `MediaEmbedder.tsx:116-128` — fake upload with client UUID
- Both have TODO comments but no ticket references

## Proposed Solutions

### Option A: Make stubs fail explicitly (Recommended)

- PremiumContentPaywall: throw error or show "not yet available" instead of calling onPaymentComplete
- MediaEmbedder: show error message instead of simulating success
- **Effort:** Small (15 min)
- **Risk:** Low

### Option B: Leave as-is with ticket references

- Add ticket references to TODO comments so they don't go stale
- Accept that these are known stubs for v2.0 Sprint 0
- **Effort:** Trivial (5 min)
- **Risk:** Low

## Acceptance Criteria

- [x] Placeholder stubs fail explicitly with descriptive error messages
- [x] No silent-success behavior that misleads users

## Work Log

| Date       | Action                                      | Learnings                        |
| ---------- | ------------------------------------------- | -------------------------------- |
| 2026-02-26 | Created from 8-agent review (5/8 consensus) | Old tempStubs were equally no-op |
