---
status: complete
priority: p3
issue_id: '301'
tags: [code-review, frontend, ux]
dependencies: []
---

# Button Mutual Exclusion in Marketplace Actions

## Problem Statement

MarketplaceBrowser and OrderStatusTracker show multiple action buttons (Fund Escrow, Complete, Dispute) without disabling others when one is in-flight. User can trigger conflicting state transitions simultaneously.

## Findings

- `packages/frontend/src/features/creator-network/components/MarketplaceBrowser.tsx` — multiple action buttons
- `packages/frontend/src/features/creator-network/components/OrderStatusTracker.tsx` — same issue

## Proposed Solutions

### Option 1: Shared loading state for action buttons

**Approach:** Track which action is in-flight and disable all other action buttons during the request.
**Effort:** 30min **Risk:** Low

## Acceptance Criteria

- [ ] Only one action can be in-flight at a time
- [ ] All other buttons disabled during action
- [ ] Loading indicator on active button

## Work Log

### 2026-02-18 - Code Review Discovery

**By:** Claude Code (13-agent parallel review)
