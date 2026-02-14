---
status: pending
priority: p3
issue_id: 017
tags: [code-review, architecture]
dependencies: []
---

# Scoped Service Middleware

## Problem Statement

Services registered as "scoped" behave as singletons because no per-request scope is ever created. Route files resolve from root container, not a request-scoped child.

## Findings

Architecture-strategist found ServiceContainer supports createScope() but no middleware calls it. All scoped services cached in root container's scopedInstances on first resolution.

## Proposed Solutions

### Option A: Implement per-request scoping middleware

**Effort:** Medium
**Risk:** Medium

Add Express middleware that creates a scoped container per request and attaches to req context.

### Option B: Reclassify scoped services as singletons

**Effort:** Small
**Risk:** Low

Reclassify all "scoped" services as singletons to match actual behavior.

## Technical Details

**Affected Files:** packages/backend/src/container/ServiceContainer.ts, packages/backend/src/app.ts

## Acceptance Criteria

- [ ] Either scoped services are actually scoped per-request, or lifetime annotations accurately reflect singleton behavior

## Work Log

- 2026-02-11: Created from /workflows:review multi-agent code review
