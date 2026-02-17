# Phase 7 P1 Remediation Plan

## Context

PR #82 (Phase 7 Creator Safety Net — EPIC-007 Wellness + EPIC-008 Content Shield) introduced 5 P1 critical bugs discovered during `/workflows:review`. All are backend-only behavioral defects in `packages/backend/src/services/`.

## Todo Items

| Todo | Issue                                          | File                             | Effort |
| ---- | ---------------------------------------------- | -------------------------------- | ------ |
| 147  | V2 routes not mounted in app.ts                | `app.ts`                         | 15 min |
| 148  | deleteAllWellnessData not atomic (GDPR)        | `WellnessService.ts` + migration | 1-2 hr |
| 149  | Alert status TOCTOU race condition             | `AlertService.ts` + migration    | 1-2 hr |
| 150  | Work pattern upsert overwrites data            | `WellnessService.ts`             | 1 hr   |
| 151  | BurnoutScoringService silently swallows errors | `BurnoutScoringService.ts`       | 1-2 hr |

## Approach: Solo Backend Fixes (No Team)

These are 5 focused backend fixes in 4 files. All are independent (no dependencies between them). A team would be overkill — the planning is already done in the todo files, and the fixes are well-scoped.

**Estimated total effort:** ~3-4 hours solo
**Team alternative:** `/team-builder minimal` (~$2.40-3.60, but adds coordination overhead for simple fixes)

**Decision: Solo execution** — maximizes speed and token efficiency for well-specified fixes.

## Fix Order (Sequential, Dependency-Free)

### Fix 1: Mount V2 Routes (Todo 147)

**File:** `packages/backend/src/app.ts`
**Change:**

- [ ] Add `import { v2Router } from './routes/v2';`
- [ ] Add `app.use('/api/v2', v2Router);` after existing v1 route mounts
- [ ] Verify all 24 endpoints respond (grep for route definitions, confirm they match)

### Fix 2: Atomic Wellness Data Deletion (Todo 148)

**File:** `packages/backend/src/services/wellness/WellnessService.ts` lines 316-337
**Change:**

- [ ] Create a Supabase RPC function `delete_all_wellness_data(p_creator_id UUID)` that wraps all 5 DELETEs in a transaction
- [ ] Replace the 5 sequential `.delete()` calls with a single `supabase.rpc('delete_all_wellness_data', { p_creator_id: creatorId })`
- [ ] Handle RPC error as complete failure (no partial state)
- [ ] Add migration file for the new function

### Fix 3: Atomic Alert Status Update (Todo 149)

**File:** `packages/backend/src/services/provenance/AlertService.ts` lines 129-172
**Change:**

- [ ] Replace read-then-write with atomic conditional update:
  ```typescript
  const { data, error } = await supabase
    .from('content_alerts')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', alertId)
    .eq('status', currentExpectedStatus) // Only updates if still in expected state
    .select()
    .single();
  ```
- [ ] If `data` is null (0 rows updated), throw `ConflictError` (409)
- [ ] Remove the separate read query (no longer needed)
- [ ] Keep the state machine validation (validate transition BEFORE attempting)

### Fix 4: Accumulate Work Patterns (Todo 150)

**File:** `packages/backend/src/services/wellness/WellnessService.ts` lines 36-72
**Change:**

- [ ] Change upsert conflict resolution from full-row replace to accumulation:
  ```typescript
  await supabase.rpc('upsert_work_pattern', {
    p_creator_id: creatorId,
    p_date: date,
    p_duration: sessionDuration,
    p_energy_level: energyLevel,
    p_focus_score: focusScore,
  });
  // SQL: ON CONFLICT (creator_id, date) DO UPDATE SET
  //   total_duration = work_patterns.total_duration + EXCLUDED.duration,
  //   session_count = work_patterns.session_count + 1,
  //   avg_energy = (work_patterns.avg_energy * work_patterns.session_count + EXCLUDED.energy_level) / (work_patterns.session_count + 1)
  ```
- [ ] Add migration for `upsert_work_pattern` RPC function
- [ ] Ensure `session_count` column exists (add in migration if missing)

### Fix 5: Propagate Database Errors (Todo 151)

**File:** `packages/backend/src/services/wellness/BurnoutScoringService.ts` lines 60-63, 90-103, 125-130
**Change:**

- [ ] Remove catch blocks that return fallback values
- [ ] Let errors propagate to the route-level error handler
- [ ] Add `logger.error()` calls for observability:

  ```typescript
  // REMOVE:
  catch (error) { return []; }

  // REPLACE WITH:
  catch (error) {
    logger.error('Failed to fetch work patterns', { error, creatorId });
    throw error; // Let route error handler return 503
  }
  ```

- [ ] Ensure the wellness route error handler returns 503 for DB errors (not 500)

## Verification

After all 5 fixes:

- [ ] `npx tsc --noEmit 2>&1 | grep -i "phase7\|wellness\|provenance\|alert"` — zero errors in new files
- [ ] Grep for remaining catch-and-return-default patterns in Phase 7 services
- [ ] Grep for remaining multi-table writes without transactions
- [ ] Verify v2Router import and mount exist in app.ts
- [ ] Review all changes with `git diff` before committing

## Post-Fix

- [ ] Update todo files: rename 147-151 from `pending` to `complete`
- [ ] Run `/workflows:compound` to document the fixes
