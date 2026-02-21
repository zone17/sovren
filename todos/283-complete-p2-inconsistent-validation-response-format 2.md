---
status: complete
priority: p2
issue_id: '283'
tags: [code-review, architecture, consistency]
dependencies: []
---

# Inconsistent Validation and Response Format Across Epics

## Problem Statement

EPIC-011 uses Zod validation + createApiResponse() helper consistently. EPIC-010 uses inline typeof checks and manual res.json() with varying shapes. EPIC-009B mixes both. Frontend must handle multiple response formats.

## Findings

- `packages/backend/src/routes/v2/` — three different validation/response patterns across epics
- `packages/backend/src/validators/finance.ts` — Zod schemas only for EPIC-011

## Proposed Solutions

### Option 1: Standardize on Zod + createApiResponse

**Approach:** Apply the EPIC-011 pattern (Zod schemas + createApiResponse helper) to EPIC-009B and EPIC-010 routes.
**Effort:** 3-4h **Risk:** Low (additive)

## Acceptance Criteria

- [ ] All routes use Zod validation
- [ ] All routes use createApiResponse() helper
- [ ] Consistent error response shape across all epics
- [ ] Frontend can rely on single response envelope

## Work Log

### 2026-02-18 - Code Review Discovery

**By:** Claude Code (13-agent parallel review)
