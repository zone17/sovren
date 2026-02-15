---
status: pending
priority: p1
issue_id: 001
tags: [code-review, security]
dependencies: []
---

# SQL Injection in Lightning Payment Service

## Problem Statement

SQL injection vulnerability via raw JSON concatenation in lightning-payment-service.ts line 719. The `metadata` object is serialized via JSON.stringify() and directly interpolated into raw SQL via template literal in supabase.raw(). Also line 351 uses raw SQL pattern.

## Findings

Security-sentinel found `supabase.raw()` with string interpolation at line 719 allows SQL breakout via crafted metadata. Pattern also at line 351 with `supabase.raw('priority + 1')`. OWASP A03:2021 Injection.

## Proposed Solutions

### Option A: Parameterized JSONB Operations

Use parameterized JSONB operations: `supabase.raw('metadata || $1::jsonb', [JSON.stringify(metadata)])`.

**Pros:** Immediate security fix, minimal code changes, follows PostgreSQL best practices
**Cons:** Still uses raw SQL API, requires careful review of all supabase.raw() calls
**Effort:** Small
**Risk:** Low

### Option B: Native Supabase Client JSONB Merge

Remove supabase.raw() entirely, use Supabase client's native JSONB merge.

**Pros:** Eliminates raw SQL surface area, more idiomatic Supabase usage
**Cons:** May require more extensive refactoring, potential behavior changes
**Effort:** Medium
**Risk:** Low

## Technical Details

**Affected Files:** packages/backend/src/services/lightning-payment-service.ts (lines 351, 719)

## Acceptance Criteria

- [ ] No string interpolation in any supabase.raw() call
- [ ] All raw SQL uses parameterized queries ($1, $2 placeholders)
- [ ] Security testing confirms SQL injection payloads are blocked
- [ ] Code review confirms all metadata operations are safe

## Work Log

- 2026-02-11: Created from /workflows:review multi-agent code review
