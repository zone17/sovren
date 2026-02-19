---
status: complete
priority: p3
issue_id: '299'
tags: [code-review, typescript, architecture]
dependencies: []
---

# Missing Shared Types for Community and Finance Entities

## Problem Statement

Community and finance entities (Circle, MentorshipRequest, Contract, Invoice, etc.) don't have shared TypeScript types. Frontend and backend define shapes independently, risking drift.

## Findings

- `packages/shared/src/types/` — no community.ts or finance.ts with entity interfaces
- Frontend and backend each define their own versions

## Proposed Solutions

### Option 1: Create shared entity types

**Approach:** Define canonical interfaces in packages/shared for all Wave 2 entities. Import in both frontend and backend.
**Effort:** 3-4h **Risk:** Low

## Acceptance Criteria

- [ ] Shared types for all Wave 2 entities
- [ ] Frontend imports from shared
- [ ] Backend imports from shared
- [ ] No duplicate type definitions

## Work Log

### 2026-02-18 - Code Review Discovery

**By:** Claude Code (13-agent parallel review)
