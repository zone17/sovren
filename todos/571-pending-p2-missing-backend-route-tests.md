---
status: pending
priority: p2
issue_id: '571'
tags: [code-review, pr-108, testing]
---

# Add backend integration tests for discovery route

## Problem Statement

The new `GET /api/v2/discovery/creators` endpoint has zero backend tests. The inline query logic (no service layer) means there's no unit test surface. At minimum, integration tests should verify the route handler's query building, parameter validation, response shape, and error handling.

**Consensus: 2/9 agents (Git History, Architecture)**

## Findings

- No test file for `discovery.routes.ts`
- Route has Zod validation, query building, data mapping, and error handling — all untested
- CLAUDE.md requires 95% coverage for new code

## Proposed Solutions

Create `packages/backend/src/routes/v2/__tests__/discovery.routes.test.ts` with tests for:

- Valid search returns correct response shape
- Zod validation rejects invalid params
- Empty results return correct pagination
- Error handling returns proper error response

## Acceptance Criteria

- [ ] Integration test file created
- [ ] Tests cover: valid search, invalid params, empty results, error handling
- [ ] Tests cover sort and category filter behavior
