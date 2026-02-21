---
status: complete
priority: p2
issue_id: '286'
tags: [code-review, data-integrity, schema-drift]
dependencies: []
---

# TypeScript/SQL Schema Drift (5 Missing Columns)

## Problem Statement

The security hardening migration (epic010_security_hardening.sql) adds 5 columns to existing tables but TypeScript interfaces don't reflect these additions. Code accessing these columns will fail type checks or use incorrect types.

## Findings

- `supabase/migrations/20260220100400_epic010_security_hardening.sql` — adds release_status, release_attempts to service_orders; review_text expanded to 10000
- TypeScript interfaces for service_orders don't include release_status or release_attempts
- Scoped idempotency_key constraint not reflected in types

## Proposed Solutions

### Option 1: Regenerate types from schema

**Approach:** Run `supabase gen types typescript` and update the shared types package. Add release_status and release_attempts to ServiceOrder interface.
**Effort:** 1h **Risk:** Low

## Acceptance Criteria

- [ ] ServiceOrder type includes release_status and release_attempts
- [ ] All migration-added columns reflected in TS types
- [ ] No schema drift between SQL and TypeScript

## Work Log

### 2026-02-18 - Code Review Discovery

**By:** Claude Code (13-agent parallel review)
