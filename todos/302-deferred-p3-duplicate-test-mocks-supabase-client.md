---
status: deferred
priority: p3
issue_id: '302'
tags: [code-review, testing, duplication]
dependencies: []
---

# Duplicate Test Mocks for Supabase Client

## Problem Statement

When tests are added for Wave 2, each test file will likely create its own Supabase mock. Existing tests already show this duplication pattern. A shared mock factory would reduce boilerplate.

## Findings

- Pattern observed in existing test files across the codebase
- No shared Supabase mock factory exists

## Proposed Solutions

### Option 1: Create shared Supabase mock factory

**Approach:** Create packages/testing/src/mocks/supabase.ts with a configurable mock factory for the Supabase client.
**Effort:** 2h **Risk:** Low

## Acceptance Criteria

- [ ] Shared Supabase mock factory exists
- [ ] Factory supports common query patterns
- [ ] Existing tests migrated to use factory

## Work Log

### 2026-02-18 - Code Review Discovery

**By:** Claude Code (13-agent parallel review)
