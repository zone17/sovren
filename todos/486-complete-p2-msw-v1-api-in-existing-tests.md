---
status: pending
priority: p2
issue_id: '486'
tags:
  - code-review
  - msw
  - test-infrastructure
  - phase-9
dependencies: []
---

# Existing integration tests use MSW v1 API (rest instead of http)

## Problem Statement

Two existing integration test files import `rest` from `msw` (v1 API) while the new handler infrastructure uses `http` from `msw` (v2 API). MSW v2 removed the `rest` export — these tests will fail or are using a compat shim that may be removed.

**Consensus: 2/7 review agents flagged this.**

## Findings

Files using v1 API:

- `__tests__/integration/engagement-analytics-integration.test.tsx`
- One other integration test file (need to grep to confirm)

## Proposed Solutions

### Option A: Migrate to MSW v2 API (Recommended)

Replace `import { rest } from 'msw'` with `import { http, HttpResponse } from 'msw'`. Update handler syntax from `rest.get(url, (req, res, ctx) => res(ctx.json(data)))` to `http.get(url, () => HttpResponse.json(data))`.
**Effort:** Small
**Risk:** Low

## Acceptance Criteria

- [ ] No imports of `rest` from `msw` remain in codebase
- [ ] All MSW usage uses v2 API (`http`, `HttpResponse`)

## Work Log

| Date       | Action                          | Learnings                                                                  |
| ---------- | ------------------------------- | -------------------------------------------------------------------------- |
| 2026-02-24 | Created from Phase 9 MSW review | MSW v1->v2 migration: `rest` -> `http`, response helpers -> `HttpResponse` |
