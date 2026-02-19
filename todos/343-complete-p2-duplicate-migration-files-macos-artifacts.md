---
status: pending
priority: p2
issue_id: 343
tags: [code-review, cleanup]
---

# Duplicate migration files (macOS " 2" artifacts) + `community 2.ts` validator

## Problem Statement

There are 3 SQL migration files with macOS " 2" suffix artifacts in the migrations directory and 1 duplicate `community 2.ts` validator file. These are accidental copies created by macOS when files are duplicated (Finder appends " 2" to the filename). They add confusion, could be accidentally applied, and clutter the codebase.

## Findings

- `supabase/migrations/` — 3 SQL files with " 2" suffix (macOS duplicate artifacts)
- `packages/backend/src/validators/community 2.ts` — duplicate validator file
- All 4 files are duplicates of their non-" 2" counterparts

## Proposed Solutions

1. Delete all 4 duplicate files:
   - 3 SQL migration files with " 2" suffix in `supabase/migrations/`
   - 1 `community 2.ts` in `packages/backend/src/validators/`
2. Verify the originals (without " 2") are intact and correct
3. Consider adding a lint rule or pre-commit hook to catch files with " 2" suffix

## Technical Details

- **Affected Files**: 3 files in supabase/migrations/ (with " 2" suffix), packages/backend/src/validators/community 2.ts

## Acceptance Criteria

- [ ] All 4 duplicate " 2" files deleted
- [ ] Original files verified intact
- [ ] No references to the deleted files exist
- [ ] Clean `git status` after deletion
