---
status: pending
priority: p3
issue_id: '145'
tags:
  - code-review
  - round-7
  - architecture
  - refactoring
dependencies: []
---

# 145: 5 God Classes Need Decomposition (Subscription Service at 1,114 Lines)

## Problem Statement

5 backend services exceed 500 lines and have too many responsibilities:

- `subscription-management-service.ts` — 1,114 lines (billing, lifecycle, invoicing, analytics, notifications)
- `lightning-service.ts` — ~900 lines (invoices, payments, webhooks, cache management)
- `content-management.ts` routes — 850 lines (CRUD, media, collections, series, premium)
- `receipt-service.ts` — ~800 lines (generation, persistence, PDF rendering, templates)
- `analytics.ts` routes — 745 lines

**Why it matters**: God classes are hard to test, hard to modify, and create implicit coupling between unrelated features.

## Findings

**Pattern Recognition (Round 7)**: Identified 5 God classes with >500 lines each.
**Code Simplicity (Round 7)**: Corroborated — subscription service alone could be split into 3 focused services.

## Proposed Solutions

### Option A: Extract Focused Services (Recommended)

**Effort**: Large | **Risk**: Medium

Split subscription-management-service into:

- `SubscriptionBillingService` — payment processing, invoicing
- `SubscriptionLifecycleService` — create, pause, resume, cancel
- `SubscriptionAnalyticsService` — metrics, reporting

**Pros**: Single responsibility, easier testing
**Cons**: Large refactor, risk of breaking existing code

## Acceptance Criteria

- [ ] No service file exceeds 400 lines
- [ ] Each extracted service has focused responsibility
- [ ] All existing tests continue to pass after decomposition

## Work Log

| Date       | Action                                            | Learnings                                 |
| ---------- | ------------------------------------------------- | ----------------------------------------- |
| 2026-02-15 | Created from Round 7 pattern + simplicity reviews | God classes compound complexity over time |
