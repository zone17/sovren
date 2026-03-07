---
status: pending
priority: p2
issue_id: '705'
tags: [code-review, backend, duplication, refactor, slice-8]
dependencies: []
---

# stripControlChars duplicated in 2 services

## Problem Statement

An identical `stripControlChars()` function (~8 LOC) is copy-pasted in both CreatorCircleService.ts and MentorshipService.ts.

**Agent consensus: 4/9** (Pattern, Simplicity, Architecture, TypeScript)

## Fix

Extract `stripControlChars()` to a shared utility in `@shared/` (e.g., `packages/shared/src/utils/sanitize.ts`) or `packages/backend/src/utils/`. Update both `CreatorCircleService.ts` and `MentorshipService.ts` to import from the shared location.
