---
status: pending
priority: p3
issue_id: '148'
tags:
  - code-review
  - round-7
  - simplicity
  - dead-code
dependencies: []
---

# 148: ~1,900 Lines of Removable Dead Code / YAGNI Violations

## Problem Statement

The code simplicity reviewer identified ~1,900 lines (35% of reviewed code) that could be removed:
- Unused error classes in error-handler-middleware.ts
- BrowserPool complexity (single Puppeteer instance would suffice at current scale)
- PaymentPersistence interface designed for Supabase swap that may never happen
- Stub analytics service with full interface but no implementation
- Duplicate NOSTR auth services (3 implementations found)
- Dead utility functions

**Why it matters**: Dead code increases cognitive load, maintenance burden, and attack surface without providing value.

## Findings

**Code Simplicity (Round 7)**: ~1,900 lines removable at 35% ratio.
**Pattern Recognition (Round 7)**: 3 duplicate NOSTR auth services identified.

## Proposed Solutions

### Incremental Cleanup
**Effort**: Medium | **Risk**: Low

Remove dead code in small, focused PRs:
1. Delete unused error classes
2. Consolidate 3 NOSTR auth services into 1
3. Remove stub analytics service
4. Simplify BrowserPool if single-instance suffices

## Acceptance Criteria

- [ ] Unused error classes removed from error-handler-middleware
- [ ] Duplicate NOSTR auth services consolidated to single implementation
- [ ] Stub analytics service removed (or marked with TODO if intentionally deferred)
- [ ] Dead utility functions removed
- [ ] Net code reduction of 500+ lines (conservative target for sprint scope)
- [ ] All existing tests pass after removal

**Scope note**: Focus on safe, obviously-dead code. Skip BrowserPool simplification (needs usage analysis) and PaymentPersistence interface (actively used pattern from P1 sprint).

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-15 | Created from Round 7 simplicity review | Regular dead code cleanup prevents accumulation |
