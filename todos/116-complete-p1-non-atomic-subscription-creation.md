---
status: pending
priority: p1
issue_id: '116'
tags:
  - code-review
  - data-integrity
  - payment
  - subscription
dependencies: []
---

# 116: Non-Atomic Subscription Creation — 4 Sequential DB Operations Without Transaction

## Problem Statement

`createSubscription` in `/packages/backend/src/services/subscription-management-service.ts` (lines 380-434) performs 4 sequential database operations without a transaction: (1) Insert subscription, (2) Create recurring payment, (3) Generate invoice, (4) Update tier subscriber count. If step 3 or 4 fails, orphaned records exist — subscription without invoice, wrong subscriber count.

## Findings

- **Line 381**: Insert subscription record
- **Line 399**: Create recurring payment schedule
- **Line 409**: Generate initial invoice
- **Line 427**: Update tier subscriber count
- No transaction wrapper around these 4 operations
- Partial failures leave orphaned/inconsistent data:
  - Subscription exists but no invoice generated
  - Subscriber count incremented but subscription failed
  - Recurring payment created but subscription rollback failed

## Proposed Solutions

**Option A: Wrap in Supabase RPC transaction (Recommended)**

- Use Supabase transaction support to ensure atomicity
- All 4 operations succeed or all roll back
- Effort: Medium, Risk: Low

**Option B: Implement compensating transaction with cleanup**

- On failure, explicitly reverse successful operations
- Track state and rollback in reverse order
- Effort: Medium, Risk: Medium (complex error handling)

## Acceptance Criteria

- [ ] All 4 operations succeed or none do (atomicity)
- [ ] No orphaned subscription records
- [ ] Subscriber count always accurate
- [ ] Transaction rollback tested for each failure point
- [ ] No partial state visible to other requests during creation

## Work Log

| Date       | Action                                      | Learnings                                                                  |
| ---------- | ------------------------------------------- | -------------------------------------------------------------------------- |
| 2026-02-14 | Identified in code review round 6 of PR #73 | Multi-step state changes in payment systems require transaction boundaries |
