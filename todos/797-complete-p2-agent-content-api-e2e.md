---
status: pending
priority: p2
issue_id: 797
tags: [e2e, agent-native, api, playwright, journey-15]
dependencies: [790]
---

# Agent Content CRUD API E2E Tests (Journey 15)

## Problem Statement
Zero agent-native API tests exist. The entire agent path for content CRUD is untested. No `*.api.spec.ts` files exist in the codebase.

## Findings
- Depends on: #790 (API project in playwright config)
- API tests use Playwright `request` context — no browser needed
- Require `USE_BACKEND=1` for real backend
- Endpoints: POST /api/v1/content/publish, GET /api/v1/content, GET /api/v1/content/:id, DELETE /api/v1/content/:id
- Gherkin in `docs/plans/user-journey-gherkins.md` Journey 15

## Proposed Solutions

### Deliverables
1. `e2e/agent-content.api.spec.ts` — 8-10 tests:
   - Create article content via API
   - Create content with file upload via API
   - List all content (pagination)
   - Read single content item
   - Delete own content
   - Structured error on validation failure (400)
   - 404 for nonexistent content
   - 401 without auth token
   - (skip) DELETE ownership check — documents P1 security gap

### Auth Strategy
- `beforeAll`: authenticate via /api/auth/challenge + /api/auth/authenticate
- Store token for all tests

## Acceptance Criteria
- [ ] `agent-content.api.spec.ts` exists with 8+ tests
- [ ] Content CRUD cycle works via API only
- [ ] Error responses are structured (success=false, error object)
- [ ] Security gap test documented as `.skip`
- [ ] All tests clean up created content

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-09 | Created from user journey audit | First agent-native E2E test |
