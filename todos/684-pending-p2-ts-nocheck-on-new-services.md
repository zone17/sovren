---
status: pending
priority: p2
issue_id: "684"
tags: [code-review, backend, typescript, slice-8]
dependencies: ["681", "682"]
---

# Remove @ts-nocheck from new FollowService + NotificationPersistenceService

## Problem Statement

Both new service files start with `// @ts-nocheck`, suppressing ALL type checking. This is why the table name mismatch (681) and pubkey/UUID mismatch (682) were not caught by `tsc`. These are brand new files, not legacy code. Violates the 94% type-safety target.

**Agent consensus: 3/8** (Pattern, TypeScript, Architecture)

## Findings

- `FollowService.ts:1` — `// @ts-nocheck`
- `NotificationPersistenceService.ts:1` — `// @ts-nocheck`
- `CommentsService.ts` (same slice) has NO `@ts-nocheck`
- The `@ts-nocheck` directly enabled P1 bugs #681, #682, #685

## Proposed Solutions

### Remove @ts-nocheck and fix resulting type errors
- Remove the directive from both files
- Fix any resulting compiler errors (likely minimal after #681 and #682 fixes)
- **Effort:** Small (after #681 and #682 are fixed)
- **Risk:** Low

## Acceptance Criteria

- [ ] `// @ts-nocheck` removed from both files
- [ ] `npx tsc --noEmit -p packages/backend/tsconfig.json` passes (or only pre-existing errors)
- [ ] No `as any` casts added to work around type issues
