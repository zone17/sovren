---
status: pending
priority: p1
issue_id: "192"
tags: [code-review, pr-85, type-safety]
---

# `db: any` Used Across All 6 Distribution Services

## Problem Statement
All 6 distribution services use `db: any` as their constructor parameter instead of the `ISupabaseClient` interface. This cascades 22 `any` types through method returns, defeating dependency injection type safety across the entire distribution module. Bugs from incorrect query construction, missing columns, or wrong table names will not be caught at compile time.

## Findings
- **File**: `packages/backend/src/services/distribution/PlatformConnectionService.ts`, line 39 — `constructor(private db: any)`
- **File**: `packages/backend/src/services/distribution/CrossPostService.ts`, line 24 — `constructor(private db: any)`
- **File**: `packages/backend/src/services/distribution/UnifiedInboxService.ts`, line 16 — `constructor(private db: any)`
- **File**: `packages/backend/src/services/distribution/CrossPlatformAnalyticsService.ts`, line 20 — `constructor(private db: any)`
- **File**: `packages/backend/src/services/distribution/RepurposingService.ts`, line 36 — `constructor(private db: any)`
- **File**: `packages/backend/src/services/distribution/ContentScannerProcessor.ts` — `constructor(private db: any)`
- All query results typed as `any` — no compile-time validation of column names, return shapes, or query correctness
- 22 instances of `any` type propagation through method returns across these 6 files

## Proposed Solutions

### Solution 1: Replace with ISupabaseClient Interface (Recommended)
1. Change `db: any` to `db: ISupabaseClient` in all 6 service constructors
2. Update or extend `ISupabaseClient` interface to include typed methods for the tables used by distribution services
3. Use Supabase's generated types (from `supabase gen types`) for table row types
4. Fix any resulting type errors — these are real bugs surfaced by proper typing

**Pros**: Catches query bugs at compile time, enables IDE autocompletion, documents data shapes
**Cons**: May surface existing bugs that need fixing, requires ISupabaseClient interface updates

### Solution 2: Use SupabaseClient Type Directly
Import the concrete `SupabaseClient` type from `@supabase/supabase-js` instead of an interface.

**Pros**: Quick fix, full type coverage from library types
**Cons**: Couples services to concrete Supabase client, harder to mock in tests, violates DI principle

## Acceptance Criteria
- [ ] All 6 distribution service constructors use `ISupabaseClient` (or equivalent typed interface) instead of `any`
- [ ] No `any` types remain in distribution service method signatures or return types
- [ ] `ISupabaseClient` interface covers the tables and operations used by distribution services
- [ ] All distribution services compile without type errors after the change
- [ ] Existing tests continue to pass (mock objects may need type updates)
- [ ] `tsc --noEmit` passes for the distribution service files
