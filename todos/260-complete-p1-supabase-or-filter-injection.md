---
status: complete
priority: p1
issue_id: '260'
tags: [code-review, security]
dependencies: []
---

# Supabase .or() Filter Injection in MentorshipService

## Problem Statement

getMentors() passes user-supplied filter values into Supabase .or() filter strings without sanitization, enabling filter predicate injection.

## Findings

- `packages/backend/src/services/community/MentorshipService.ts` — .or() with unsanitized user input

## Proposed Solutions

### Option 1: Use typed filter methods

**Approach:** Replace .or() string concatenation with .eq()/.in() typed methods. Validate/whitelist filter values.
**Effort:** 1-2h **Risk:** High

## Acceptance Criteria

- [ ] No user input in .or() strings
- [ ] Filter values validated/whitelisted
- [ ] Tests cover injection attempts

## Work Log

### 2026-02-18 - Code Review Discovery

**By:** Claude Code (13-agent parallel review)
