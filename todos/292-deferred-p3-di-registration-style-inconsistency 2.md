---
status: deferred
priority: p3
issue_id: '292'
tags: [code-review, architecture, consistency]
dependencies: []
---

# DI Registration Style Inconsistency

## Problem Statement

EPIC-009B services register in DI container using one pattern while EPIC-010/011 services use a slightly different registration pattern. Both work but inconsistency makes onboarding harder.

## Findings

- `packages/backend/src/container/` — two registration patterns across epics

## Proposed Solutions

### Option 1: Standardize registration pattern

**Approach:** Pick one pattern and apply it consistently. Update docs with the canonical example.
**Effort:** 1h **Risk:** Low

## Acceptance Criteria

- [ ] All services use same DI registration pattern
- [ ] Container setup is consistent

## Work Log

### 2026-02-18 - Code Review Discovery

**By:** Claude Code (13-agent parallel review)
