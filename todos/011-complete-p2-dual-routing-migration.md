---
status: pending
priority: p2
issue_id: 011
tags: [code-review, architecture]
dependencies: []
---

# Dual Routing System Migration Path

## Problem Statement

Two parallel route systems: legacy (/api/auth, /api/users, /api/lightning) and v1 (/api/v1/content, /api/v1/users, /api/v1/payments). No migration path documented. subscription-tiers.ts and content-discovery.ts routes not mounted in app.ts.

## Findings

Architecture-strategist found /api/users and /api/v1/users coexist. Pattern-recognition found route files not mounted in app.ts. Agent-native found legacy routes exist but aren't accessible.

## Proposed Solutions

### Option A: Document Deprecation Timeline and Mount Missing Routes

**Pros:** Clear migration path for API consumers, unmounts orphaned route files, establishes v1 as primary API
**Cons:** Requires coordination with frontend team on migration
**Effort:** Medium
**Risk:** Low

## Technical Details

**Affected Files:**

- packages/backend/src/app.ts
- packages/backend/src/routes/content-discovery.ts
- packages/backend/src/routes/subscription-tiers.ts

## Acceptance Criteria

- [ ] All route files are mounted in app.ts
- [ ] subscription-tiers.ts routes accessible via app
- [ ] content-discovery.ts routes accessible via app
- [ ] Migration documentation exists explaining v1 transition
- [ ] Legacy routes marked with deprecation notices in code
- [ ] Deprecation timeline defined (e.g., remove legacy in 3 months)
- [ ] v1 equivalents created for auth and lightning endpoints
- [ ] Tests verify all routes are accessible

## Work Log

- 2026-02-11: Created from /workflows:review multi-agent code review
