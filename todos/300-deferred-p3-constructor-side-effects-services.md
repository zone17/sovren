---
status: deferred
priority: p3
issue_id: '300'
tags: [code-review, architecture, testability]
dependencies: []
---

# Constructor Side Effects in Services

## Problem Statement

Several services perform async operations (BullMQ queue setup, Supabase client initialization) in their constructors. This makes unit testing harder and can cause unhandled promise rejections.

## Findings

- `packages/backend/src/services/inbox/AdaptivePollingService.ts` — queue setup in constructor
- Other services with initialization logic in constructors

## Proposed Solutions

### Option 1: Lazy initialization pattern

**Approach:** Move async setup to an init() method or use lazy initialization on first use. Constructor only stores dependencies.
**Effort:** 2h **Risk:** Low

## Acceptance Criteria

- [ ] No async operations in constructors
- [ ] Services testable without mocking constructors
- [ ] Init errors properly handled

## Work Log

### 2026-02-18 - Code Review Discovery

**By:** Claude Code (13-agent parallel review)
