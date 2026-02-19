---
status: deferred
priority: p2
issue_id: '281'
tags: [code-review, architecture, duplication]
dependencies: []
---

# Duplicate ApiResponse<T> and Pagination Types

## Problem Statement

ApiResponse<T> and PaginationParams types are redefined in multiple locations instead of importing from a single source. Changes to the response envelope require updating multiple files.

## Findings

- `packages/shared/src/types/` — original definitions
- `packages/backend/src/routes/v2/` — redefined in route files
- `packages/frontend/src/types/` — redefined for frontend

## Proposed Solutions

### Option 1: Single source in shared package

**Approach:** Define once in packages/shared/src/types/api.ts, export from barrel, import everywhere.
**Effort:** 1-2h **Risk:** Low

## Acceptance Criteria

- [ ] Single ApiResponse<T> definition in shared
- [ ] Single PaginationParams definition in shared
- [ ] All consumers import from shared
- [ ] No local redefinitions

## Work Log

### 2026-02-18 - Code Review Discovery

**By:** Claude Code (13-agent parallel review)
