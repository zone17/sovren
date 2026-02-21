---
status: complete
priority: p1
issue_id: '267'
tags: [code-review, frontend, financial]
dependencies: []
---

# MarketplaceBrowser Double-Order via Fresh Idempotency Key

## Problem Statement

placeOrder generates a fresh crypto.randomUUID() idempotency key on every click, defeating duplicate prevention. Double-clicking creates two orders with two escrow payments.

## Findings

- `packages/frontend/src/features/creator-network/components/MarketplaceBrowser.tsx` — new UUID per click

## Proposed Solutions

### Option 1: Generate key on intent, not click

**Approach:** Generate idempotency key on listing selection, store in state, reuse on retries. Add loading/disabled state to button.
**Effort:** 30min **Risk:** Low

## Acceptance Criteria

- [ ] Idempotency key generated once per order intent
- [ ] Button disabled during API call
- [ ] Double-click produces only one order

## Work Log

### 2026-02-18 - Code Review Discovery

**By:** Claude Code (13-agent parallel review)
