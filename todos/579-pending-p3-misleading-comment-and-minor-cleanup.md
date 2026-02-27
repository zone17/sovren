---
status: pending
priority: p3
issue_id: '579'
tags: [code-review, pr-108, backend, cleanup]
---

# Fix misleading comment and minor backend cleanup

## Problem Statement

Several minor backend issues:

1. Comment says "snake_case -> camelCase handled by createApiResponse" but the route passes `{ raw: true }` which skips auto-transform. The camelCase mapping is done manually in `.map()`.
2. `sanitizeInputs` middleware not applied to discovery route (defense-in-depth gap)
3. Canonical creator ID ambiguity — route returns `creator_profiles.id` but other endpoints may use `users.id`

## Findings

- `discovery.routes.ts`, line ~96: misleading comment about createApiResponse
- `discovery.routes.ts`: no sanitizeInputs middleware
- Three tables have three different UUIDs for the same logical creator

## Proposed Solutions

1. Fix comment: "Manual camelCase mapping; raw: true skips auto-transform"
2. Add Zod `.transform()` for defense-in-depth: `q: z.string().transform(s => s.replace(/[<>]/g, ''))`
3. Document canonical creator ID decision (prefer `users.id`)

## Acceptance Criteria

- [ ] Comment accurately describes the camelCase mapping
- [ ] Creator ID strategy documented
