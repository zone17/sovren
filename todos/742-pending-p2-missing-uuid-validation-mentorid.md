---
status: pending
priority: p2
issue_id: 742
tags: [code-review, slice-8, validation, security, mentorship, uuid]
dependencies: []
---

# #742 - Missing UUID Validation on mentorId

## Problem Statement

`RequestMentorshipSchema` in `validators/community.ts` accepts a `mentorId` field without validating that it is a valid UUID. A non-UUID value passed as `mentorId` will reach the Supabase query and either cause a PostgreSQL error (which may leak internal details) or produce unexpected behavior depending on how the DB handles malformed UUID strings.

## Findings

Single agent finding during Slice 8 Creator Network review.

- `validators/community.ts` — `RequestMentorshipSchema.mentorId` is typed as `z.string()` with no `.uuid()` refinement
- Non-UUID values (e.g., `"../admin"`, `"' OR 1=1"`, `"not-a-uuid"`) pass schema validation
- Supabase will throw a PostgreSQL error for malformed UUID input to a `uuid` column type
- That error may propagate as an unformatted 500 with internal details if not caught properly
- Related: #732 (getUserIdByPubkey untyped cast) — similar UUID validation gap

## Proposed Solutions

Add `.uuid()` to the `mentorId` field in the Zod schema:

```typescript
// In validators/community.ts — RequestMentorshipSchema
const RequestMentorshipSchema = z.object({
  mentorId: z.string().uuid(), // was z.string()
  // ...
});
```

This ensures the validation layer rejects malformed IDs with a clear 400 error message before the value ever reaches the database.

## Technical Details

- **File**: `validators/community.ts`
- **Schema**: `RequestMentorshipSchema`
- **Field**: `mentorId`
- **Fix**: Add `.uuid()` refinement to the Zod string schema
- **Zod behavior**: `z.string().uuid()` validates RFC 4122 UUID format and returns a descriptive ZodError on failure
- **Audit**: Check other schemas in `validators/community.ts` for similar ID fields missing `.uuid()` — apply the same fix to any discovered

## Acceptance Criteria

- [ ] `mentorId` in `RequestMentorshipSchema` has `.uuid()` validation
- [ ] Non-UUID `mentorId` values return 400 with Zod validation error
- [ ] Valid UUID `mentorId` values continue to pass validation
- [ ] Audit of other ID fields in `validators/community.ts` completed — any others missing `.uuid()` also fixed
- [ ] Unit test added: verify 400 returned for non-UUID mentorId
- [ ] Unit test added: verify valid UUID mentorId passes
