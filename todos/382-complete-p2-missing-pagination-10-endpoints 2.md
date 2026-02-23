---
status: pending
priority: p2
issue_id: 382
tags:
  - code-review
  - performance
  - agent-native
dependencies: []
---

# 10+ GET /list Endpoints Missing Pagination

## Problem Statement

10+ GET /list endpoints return all records without pagination parameters (limit, offset, cursor). Large datasets will degrade performance and are agent-unfriendly since agents cannot page through results efficiently.

## Findings

**Source agents:** performance-agent, agent-native-agent, code-review-agent

**Evidence:**

- File: `packages/backend/src/routes/v2/marketplace.routes.ts`
- Issue: List endpoint returns all records without pagination
- File: `packages/backend/src/routes/v2/circles.routes.ts`
- Issue: Same — no pagination support
- File: `packages/backend/src/routes/v2/mentorship.routes.ts`
- Issue: Same — no pagination support
- File: `packages/backend/src/routes/v2/business-contracts.routes.ts`
- Issue: Same — no pagination support
- File: `packages/backend/src/routes/v2/business-invoices.routes.ts`
- Issue: Same — no pagination support
- File: `packages/backend/src/routes/v2/business-tax.routes.ts`
- Issue: Same — no pagination support
- File: `packages/backend/src/routes/v2/collaboration.routes.ts`
- Issue: Same — no pagination support

## Proposed Solutions

### Option A: Add limit/offset pagination with sensible defaults

- **Approach:** Add optional `?limit=&offset=` query params with sensible defaults (limit=50, max=100). Apply `.range()` to Supabase queries. Return total count in response headers or body for client-side paging.
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected files:**

- `packages/backend/src/routes/v2/marketplace.routes.ts`
- `packages/backend/src/routes/v2/circles.routes.ts`
- `packages/backend/src/routes/v2/mentorship.routes.ts`
- `packages/backend/src/routes/v2/business-contracts.routes.ts`
- `packages/backend/src/routes/v2/business-invoices.routes.ts`
- `packages/backend/src/routes/v2/business-tax.routes.ts`
- `packages/backend/src/routes/v2/collaboration.routes.ts`

## Acceptance Criteria

- [ ] All list endpoints accept optional `limit` and `offset` query parameters
- [ ] Default limit is 50, maximum limit is 100
- [ ] Supabase queries use `.range(offset, offset + limit - 1)`
- [ ] Response includes total count for client-side pagination
- [ ] Existing clients without pagination params get default behavior (first 50 records)

## Work Log

| Date       | Action  | Notes                      |
| ---------- | ------- | -------------------------- |
| 2026-02-19 | Created | PR #86 code review finding |

## Resources

- PR: https://github.com/zone17/sovren/pull/86
