---
status: pending
priority: p2
issue_id: 008
tags: [code-review, security]
dependencies: []
---

# Missing Input Validation on Discovery Endpoints

## Problem Statement

/trending, /category/:category, and /feedback endpoints lack Zod validation schemas. Limit parameter not bounded, category not sanitized. Also subscription tiers GET allows querying any creator_id.

## Findings

Security-sentinel found inconsistent validation: /feed and /search use Zod, but /trending and /category do not. Number(limit) cast without bounds. Feedback endpoint accepts unvalidated content_id and rating.

## Proposed Solutions

### Option A: Add Zod Validation Schemas to All Discovery Endpoints

**Pros:** Consistent validation pattern across all endpoints, prevents injection attacks, bounds resource consumption
**Cons:** None significant
**Effort:** Small
**Risk:** Low

## Technical Details

**Affected Files:**

- packages/backend/src/routes/content-discovery.ts (lines 108-148, 181-218, 379-412)
- packages/backend/src/routes/subscription-tiers.ts (line 92)

## Acceptance Criteria

- [ ] All endpoints use Zod validation matching existing validated endpoints pattern
- [ ] limit parameter bounded to 1-100 range
- [ ] category parameter limited to max 100 chars with sanitization
- [ ] content_id validated as UUID format
- [ ] rating validated with appropriate bounds
- [ ] creator_id in subscription tiers validated and access-controlled
- [ ] Tests verify validation rejects invalid inputs

## Work Log

- 2026-02-11: Created from /workflows:review multi-agent code review
