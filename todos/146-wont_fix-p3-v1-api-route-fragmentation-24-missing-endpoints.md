---
status: pending
priority: p3
issue_id: '146'
tags:
  - code-review
  - round-7
  - agent-native
  - api
dependencies:
  - '119'
  - '120'
---

# 146: v1 API Route Fragmentation — 24 Missing Endpoints (45% v1 Coverage)

## Problem Statement

While combined API coverage is 100% (all UI actions have endpoints), the v1 API surface only covers 45% of capabilities (29/65). Agents must know TWO API surfaces (v1 + legacy) to accomplish all tasks. 24 endpoints are missing from v1, spread across content (12), payments (8), and users (4).

**Why it matters**: Route fragmentation creates poor developer experience for API consumers and agents. Agents cannot rely on a single consistent API surface.

**Note**: This supersedes and expands on todos 119 (user relationship API) and 120 (payment API gaps) by framing the broader fragmentation issue.

## Findings

**Agent-Native Reviewer (Round 7)**: 86/100 score. 100% combined coverage but 45% v1 coverage. 24 specific missing endpoints documented.

**Key missing v1 endpoints**:
- Content: media upload, collections, series, premium purchase (12 endpoints)
- Payments: subscription lifecycle, payout management (8 endpoints)
- Users: payment method CRUD (4 endpoints)

## Proposed Solutions

### Phased Migration (Recommended)
**Effort**: Large | **Risk**: Low

Phase 1 (2 weeks): Add media + collections + pagination to v1
Phase 2 (1 month): Add subscription lifecycle + payment methods + payouts to v1
Phase 3 (2-3 months): Deprecate and sunset legacy routes

## Acceptance Criteria

- [ ] All 65 capabilities available through v1 API
- [ ] Legacy routes deprecated with warning headers
- [ ] Pagination metadata on all v1 list endpoints

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-15 | Created from Round 7 agent-native review | Route fragmentation is a distinct issue from missing endpoints |
