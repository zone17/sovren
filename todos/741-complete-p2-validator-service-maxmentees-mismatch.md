---
status: pending
priority: p2
issue_id: 741
tags: [code-review, slice-8, correctness, validation, mentorship, schema-mismatch]
dependencies: []
---

# #741 - Validator/Service maxMentees Mismatch (100 vs 10)

## Problem Statement

`RegisterMentorSchema` in `validators/community.ts` allows `maxMentees` values up to 100, but `MentorshipService.ts` internally caps the value at 10. A user who sets `maxMentees: 50` receives a 200 response with no error, but the service silently uses 10 instead. This is a deceptive API that violates the principle of least surprise and wastes user intent.

## Findings

Single agent finding during Slice 8 Creator Network review.

- `validators/community.ts` — `RegisterMentorSchema` has `maxMentees: z.number().int().positive().max(100)`
- `services/community/MentorshipService.ts` — logic caps `maxMentees` at 10 (e.g., `Math.min(data.maxMentees, 10)` or equivalent guard)
- Values 11–100 pass validation but are silently reduced to 10 in the service
- Users who set `maxMentees: 50` believe they have capacity for 50 mentees but actually have capacity for 10
- The correct fix is to align the validator to the service's actual limit (lower bound: validator matches service cap)

## Proposed Solutions

Align the Zod schema to the service's actual maximum of 10:

```typescript
// In validators/community.ts — RegisterMentorSchema
const RegisterMentorSchema = z.object({
  // ...
  maxMentees: z.number().int().positive().max(10), // was max(100), aligned to service cap
  // ...
});
```

If the intended business limit is actually 100 (not 10), remove the service-level cap instead and align upward. Confirm the intended limit with the product owner before implementing.

**Do not use `Math.min()` as a silent coercion in the service** — the validator should enforce the limit explicitly so the client receives a 400 with a clear message rather than silent truncation.

## Technical Details

- **Files**: `validators/community.ts`, `services/community/MentorshipService.ts`
- **Current state**: validator max=100, service cap=10
- **Recommended fix**: validator max=10 (match service), remove silent `Math.min` from service
- **Business decision required**: Confirm whether 10 or 100 is the correct product limit before implementing

## Acceptance Criteria

- [ ] `maxMentees` validator max and service cap are identical values
- [ ] If value exceeds the limit, validator returns 400 with clear message (not silent truncation)
- [ ] `Math.min()` or equivalent silent cap removed from service (redundant after validator alignment)
- [ ] Unit test added: verify 400 returned when `maxMentees` exceeds the agreed limit
- [ ] Unit test added: verify accepted value is stored as-is (no silent reduction)
- [ ] Business limit (10 vs 100) confirmed and documented in a comment in the schema
