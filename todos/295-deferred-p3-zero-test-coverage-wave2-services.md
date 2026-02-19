---
status: deferred
priority: p3
issue_id: '295'
tags: [code-review, testing, coverage]
dependencies: []
---

# Zero Test Coverage for Wave 2 Services

## Problem Statement

All Wave 2 backend services (12 service files) and frontend components have zero unit or integration tests. The project standard requires 95% coverage for services.

## Findings

- `packages/backend/src/services/community/` — 4 services, 0 tests
- `packages/backend/src/services/finance/` — 4 services, 0 tests
- `packages/backend/src/services/inbox/` — 2 services, 0 tests
- `packages/frontend/src/features/` — Wave 2 components, 0 tests

## Proposed Solutions

### Option 1: Add test suites per service

**Approach:** Create test files for each service with mocked Supabase client. Target 95% branch coverage.
**Effort:** 8-12h **Risk:** Low

## Acceptance Criteria

- [ ] Each service has a test file
- [ ] Service test coverage ≥ 95%
- [ ] Frontend component tests exist
- [ ] Tests run in CI

## Work Log

### 2026-02-18 - Code Review Discovery

**By:** Claude Code (13-agent parallel review)
