---
status: complete
priority: p3
issue_id: '304'
tags: [code-review, performance, database]
dependencies: []
---

# N+1 Query Patterns in List Endpoints

## Problem Statement

Several list endpoints fetch a collection then make individual queries for related data (e.g., fetching circle members then querying each user's profile separately). This creates N+1 query patterns.

## Findings

- `packages/backend/src/services/community/CreatorCircleService.ts` — getCircleMembers loads profiles individually
- `packages/backend/src/services/community/CollaborativeContentService.ts` — loads collaborator details individually
- `packages/backend/src/services/finance/InvoicingService.ts` — loads line items per invoice

## Proposed Solutions

### Option 1: Use Supabase joins and select

**Approach:** Replace individual queries with Supabase .select('_, profile:profiles(_)') join syntax to fetch related data in one query.
**Effort:** 2h **Risk:** Low

## Acceptance Criteria

- [ ] List endpoints use single query with joins
- [ ] No N+1 patterns in list endpoints
- [ ] Response shape unchanged

## Work Log

### 2026-02-18 - Code Review Discovery

**By:** Claude Code (13-agent parallel review)
