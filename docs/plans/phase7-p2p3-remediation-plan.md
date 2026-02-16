# Phase 7 P2/P3 Remediation Plan

**Sprint:** Phase 7 PR #82 Code Review Remediation
**Branch:** `feature/phase-7-creator-safety-net`
**Scope:** 17 findings (12 P2, 5 P3) from todos 152-168
**Epics:** EPIC-007 Creator Wellness + EPIC-008 Content Shield
**Requirements Doc:** `docs/plans/phase7-p2p3-requirements.md` (30 additional acceptance criteria from PO)
**Last Updated:** 2026-02-16 (v2 -- incorporates PO feedback)

---

## Summary of All 17 Findings

| # | ID | Priority | Category | Title | Domain | Effort | Risk |
|---|-----|----------|----------|-------|--------|--------|------|
| 1 | 152 | P2 | Security | No rate limiting on v2 endpoints | Backend | 1-2h | Low |
| 2 | 153 | P2 | Data Loss | In-memory Map for sensitivity settings | Backend | 2-3h | Low |
| 3 | 154 | P2 | Security+Perf | getBenchmark() full table scan + data leak | Backend | 1-2h | Low |
| 4 | 155 | P2 | Performance | FingerprintService.compare() O(n) scan | Backend | 1-2h | Med |
| 5 | 156 | P2 | Security | RLS policy exposes creator boundaries | Backend | 30min | Low |
| 6 | 157 | P2 | Duplication | 8x duplicated SupabaseClient interface | Backend | 30min | Low |
| 7 | 158 | P2 | Duplication | Frontend type duplication ~339 lines | Frontend | 1h | Low |
| 8 | 159 | P2 | Coverage | Missing 5 frontend API methods | Frontend | 1-2h | Low |
| 9 | 160 | P2 | Auth Bug | Hardcoded PLACEHOLDER_CREATOR_ID | Frontend | 30min | Low |
| 10 | 161 | P2 | Type Safety | Logger typed as Function (8 services) | Backend | 30min | Low |
| 11 | 162 | P2 | Data Integrity | Provenance records lack immutability | Backend | 1h | Low |
| 12 | 163 | P3 | Performance | Sequential DB queries in wellness dashboard | Backend | 30min | Low |
| 13 | 164 | P3 | Performance | Missing useMemo in WellnessTrend | Frontend | 15min | Low |
| 14 | 165 | P3 | Performance | Unbounded pulse history query | Backend | 30min | Low |
| 15 | 166 | P3 | Dead Code | Unreachable at_threshold branch | Backend | 5min | Low |
| 16 | 167 | P3 | Edge Case | Division by zero in BoundarySettings | Frontend | 5min | Low |
| 17 | 168 | P3 | Security | XSS in auto_response_template | Backend+FE | 30min | Low |

**Total estimated effort:** ~12-16 hours of implementation
**Backend items:** 11 (152, 153, 154, 155, 156, 157, 161, 162, 163, 165, 166)
**Frontend items:** 6 (158, 159, 160, 164, 167, 168)

---

## Dependency Graph

```
157 (Shared SupabaseClient interface)
 ├── 153 (BurnoutScoringService uses SupabaseClient)
 ├── 154 (WellnessService uses SupabaseClient)
 ├── 155 (FingerprintService uses SupabaseClient)
 ├── 162 (ProvenanceService uses SupabaseClient)
 ├── 163 (WellnessService uses SupabaseClient)
 └── 165 (WellnessService uses SupabaseClient)

161 (ILogger typing)
 └── All 8 Phase 7 services (after 157 since both touch same files)

158 (Frontend shared types)
 └── 159 (API methods need correct types from shared package)
 └── 160 (ShieldDashboard imports from types)

156 (RLS fix) → independent (database migration)
152 (Rate limiting) → independent (middleware + routes)
166 (Dead code) → independent (trivial removal)
164 (useMemo) → independent (single component)
167 (Division by zero) → independent (single component)
168 (XSS sanitization) → partially depends on 156 (same boundary data model)
```

### Dependency Rules

1. **157 MUST happen first (backend)** -- All backend services import SupabaseClient. Consolidating the interface avoids merge conflicts when other fixes touch the same files.
2. **161 MUST follow 157** -- Both touch all 8 service files. Doing them in sequence avoids double-editing the same constructor signatures.
3. **158 MUST happen before 159 and 160 (frontend)** -- Frontend API methods and ShieldDashboard need correct type imports from shared package.
4. **157 and 158 can run in parallel** -- They are in different packages (backend vs frontend) with no cross-dependency. PO concern #5 noted ordering matters, but since 157 creates `ISupabaseClient` in backend interfaces and 158 re-exports from `@sovren/shared` types, they do not conflict.
5. **Database migrations (156, 162, 153, 154) must be numbered sequentially** -- Even though they can be developed in parallel, migration files must have sequential timestamps to avoid conflicts. Recommended order: 156 (RLS) -> 162 (immutability) -> 154 (benchmark function) -> 153 (sensitivity column).
6. All other items are independent and can run in parallel.

---

## Execution Batches

### Batch 0: Foundation (Sequential -- Must Complete First)

These fix shared infrastructure that other fixes depend on.

#### 157 - Consolidate 8x SupabaseClient Interface
- **Priority:** P2 | **Effort:** 30 min | **Risk:** Low
- **Files to modify:**
  - CREATE: `packages/backend/src/interfaces/shared/ISupabaseClient.ts`
  - MODIFY (remove local interface, add import): All 8 services:
    - `packages/backend/src/services/wellness/WellnessService.ts`
    - `packages/backend/src/services/wellness/BurnoutScoringService.ts`
    - `packages/backend/src/services/wellness/ScheduleService.ts`
    - `packages/backend/src/services/wellness/BoundaryService.ts`
    - `packages/backend/src/services/provenance/ProvenanceService.ts`
    - `packages/backend/src/services/provenance/FingerprintService.ts`
    - `packages/backend/src/services/provenance/AlertService.ts`
    - `packages/backend/src/services/provenance/DmcaService.ts`
- **Approach:**
  1. Create `ISupabaseClient.ts` in `packages/backend/src/interfaces/shared/`
  2. Define: `export interface ISupabaseClient { from(table: string): any; rpc(fn: string, params: any): any; }`
  3. Export from `packages/backend/src/interfaces/shared/index.ts` barrel
  4. In each of the 8 services: remove the local `interface SupabaseClient` block and add `import { ISupabaseClient } from '../../interfaces/shared';`
  5. Update constructor type annotations from `SupabaseClient` to `ISupabaseClient`
- **Risks:** None. Pure refactor, no behavior change.

#### 161 - Fix Logger Typing (Function -> ILogger)
- **Priority:** P2 | **Effort:** 30 min | **Risk:** Low
- **Depends on:** 157 (same files being edited)
- **Files to modify:** Same 8 services as 157
- **Approach:**
  1. ILogger already exists at `packages/backend/src/interfaces/shared/ILogger.ts` with `debug()`, `info()`, `warn()`, `error()` methods
  2. In each of the 8 services: change `private readonly logger: { info: Function; error: Function; warn: Function }` to `private readonly logger: ILogger`
  3. Add `ILogger` to the import from `../../interfaces/shared`
  4. The existing ILogger interface already has `info`, `warn`, `error`, `debug` -- superset of current usage
- **Risks:** None. ILogger is compatible superset. Existing callers pass Winston logger which implements ILogger.

#### 158 - Frontend Type Deduplication
- **Priority:** P2 | **Effort:** 1h | **Risk:** Low
- **Files to modify:**
  - `packages/frontend/src/features/wellness/types/index.ts` (replace ~189 lines with re-exports)
  - `packages/frontend/src/features/content-shield/types/index.ts` (replace ~150 lines with re-exports)
  - `packages/shared/src/types/wellness.ts` (verify all types present)
  - `packages/shared/src/types/provenance.ts` (verify all types present)
- **Approach:**
  1. Compare frontend types with shared types. Identify any frontend-only types (UI state, component props).
  2. For wellness: Replace `packages/frontend/src/features/wellness/types/index.ts` with re-exports from `@sovren/shared` plus any frontend-only types as local extensions.
  3. For content-shield: Same pattern with `@sovren/shared` provenance types.
  4. Verify all consuming components still compile.
- **Risks:** Frontend-only types (form state, UI props) may not exist in shared. These should remain local but import shared base types.

---

### Batch 1: Backend Security Fixes (Parallel)

All independent of each other. Can run in parallel after Batch 0.

#### 152 - Rate Limiting on V2 Endpoints
- **Priority:** P2 | **Effort:** 1-2h | **Risk:** Low
- **Files to modify:**
  - `packages/backend/src/routes/v2/wellness.routes.ts`
  - `packages/backend/src/routes/v2/shield.routes.ts`
- **Approach:**
  1. Rate limit middleware already exists at `packages/backend/src/middleware/rate-limit-middleware.ts` with presets: `readOnlyRateLimiter` (100/min), `contentCreationRateLimiter` (10/min), `expensiveOperationRateLimiter` (20/min), and `createRateLimiter()` factory.
  2. **Key: existing middleware already handles unauthenticated requests by IP** (PO concern #4). The default `keyGenerator` uses `req.ip`, and `createUserRateLimiter` falls back to IP when no auth token is present: `user?.nostr_pubkey || req.ip || 'unknown'`. Use `createUserRateLimiter` for authenticated routes to rate-limit by user, with IP fallback.
  3. Import appropriate limiters into both v2 route files.
  4. Apply per-route:
     - GET endpoints (reads): `readOnlyRateLimiter` (100/min) -- IP-based
     - POST/PUT/PATCH (mutations): `createUserRateLimiter({ windowMs: 60000, max: 20 })` -- user-based with IP fallback
     - Expensive operations (fingerprint compare, benchmark): `createUserRateLimiter({ windowMs: 60000, max: 5 })` -- strictest tier
  5. Add rate limit to router-level as baseline: `router.use(readOnlyRateLimiter)` then override specific routes with stricter limits.
  6. Rate limit configuration stays centralized in `rate-limit-middleware.ts` -- route files only import and apply, never define limits inline.
- **Risks:** May need to tune limits for pulse check-in frequency (could be high for real-time wellness monitoring). In-memory rate limit store is acceptable for MVP single-instance; note Redis needed for multi-instance in production.

#### 154 - Fix getBenchmark() Full Table Scan + Data Leak
- **Priority:** P2 | **Effort:** 1-2h | **Risk:** Low
- **Files to modify:**
  - `packages/backend/src/services/wellness/WellnessService.ts` (lines 357-361)
- **Approach:** Option 2 (database aggregate query) -- simpler, no new tables needed.
  1. Replace `supabase.from('wellness_snapshots').select('*')` with aggregate query using Supabase RPC function.
  2. Create SQL function with anonymity threshold (PO concern #3):
     ```sql
     CREATE OR REPLACE FUNCTION get_wellness_benchmark()
     RETURNS TABLE(avg_score numeric, stddev_score numeric, sample_count bigint) AS $$
     DECLARE
       creator_count bigint;
     BEGIN
       SELECT COUNT(DISTINCT creator_id) INTO creator_count FROM wellness_snapshots;
       -- Anonymity threshold: do not return benchmarks if fewer than 5 creators
       IF creator_count < 5 THEN
         RETURN QUERY SELECT NULL::numeric, NULL::numeric, 0::bigint;
         RETURN;
       END IF;
       RETURN QUERY SELECT AVG(score), STDDEV(score), COUNT(*) FROM wellness_snapshots;
     END;
     $$ LANGUAGE plpgsql SECURITY DEFINER;
     ```
  3. In the service layer, check `sample_count === 0` and return a "not enough data" response instead of benchmark values.
  4. Response schema: `{ average: number | null, stddev: number | null, count: number, sufficient_data: boolean }` -- no creator identifiers.
- **Risks:** Needs Supabase migration. Aggregate function runs in DB, not app -- much better but still scans all rows at DB level. Acceptable for P2.

#### 156 - Fix RLS Policy on creator_boundaries
- **Priority:** P2 | **Effort:** 30 min | **Risk:** Low
- **Files to modify:**
  - Supabase migration (new migration file)
- **Approach:**
  1. Create migration: `ALTER POLICY ... ON creator_boundaries USING (creator_id = auth.uid())`
  2. Or if policy doesn't exist yet for this table: `CREATE POLICY "Users can only read own boundaries" ON creator_boundaries FOR SELECT USING (creator_id = auth.uid())`
  3. Verify INSERT/UPDATE/DELETE policies also restricted to owner.
- **Risks:** If any feature intentionally reads other creators' boundaries (e.g., "public boundary status"), this would break it. Verify no cross-creator boundary reads exist.

#### 162 - Provenance Record Immutability
- **Priority:** P2 | **Effort:** 1h | **Risk:** Low
- **Files to modify:**
  - `packages/backend/src/services/provenance/ProvenanceService.ts` (remove update/delete methods if present)
  - Supabase migration (create immutability triggers)
- **Approach:** Trigger blocks everything + SECURITY DEFINER function for revocation (PO-approved pattern):
  1. Create Postgres trigger that blocks ALL modifications unconditionally (PO concern #2):
     ```sql
     -- Trigger fires for ALL roles including service-role, since triggers
     -- execute regardless of RLS bypass. This is database-level enforcement.
     CREATE OR REPLACE FUNCTION prevent_provenance_modification()
     RETURNS TRIGGER AS $$
     BEGIN
       RAISE EXCEPTION 'Provenance records are immutable. UPDATE/DELETE blocked for all roles including service-role.';
     END;
     $$ LANGUAGE plpgsql;

     CREATE TRIGGER enforce_provenance_immutability
     BEFORE UPDATE OR DELETE ON provenance_records
     FOR EACH ROW EXECUTE FUNCTION prevent_provenance_modification();
     ```
  2. Create a separate SECURITY DEFINER function as the **only** revocation path (PO note #3 -- cleaner than column-level trigger exception):
     ```sql
     -- This function bypasses the trigger because SECURITY DEFINER runs as the
     -- function owner, and we temporarily disable the trigger within the function.
     CREATE OR REPLACE FUNCTION revoke_provenance_record(record_id uuid)
     RETURNS void AS $$
     BEGIN
       -- Disable trigger for this transaction only
       ALTER TABLE provenance_records DISABLE TRIGGER enforce_provenance_immutability;
       UPDATE provenance_records SET status = 'revoked', revoked_at = now()
         WHERE id = record_id AND status = 'active';
       ALTER TABLE provenance_records ENABLE TRIGGER enforce_provenance_immutability;
     END;
     $$ LANGUAGE plpgsql SECURITY DEFINER;

     -- Only allow service-role to call this function
     REVOKE ALL ON FUNCTION revoke_provenance_record FROM PUBLIC;
     GRANT EXECUTE ON FUNCTION revoke_provenance_record TO service_role;
     ```
  3. **Key: triggers fire regardless of RLS bypass**, so even service-role Supabase clients cannot modify or delete provenance records via normal queries. Revocation is only possible via the dedicated function.
  4. Add `status` column (enum: 'active', 'revoked') and `revoked_at` timestamp if not present.
  5. In ProvenanceService: remove any `update()` or `delete()` methods. Add `revokeProvenance(id)` that calls `supabase.rpc('revoke_provenance_record', { record_id: id })`.
- **Risks:** The SECURITY DEFINER function with trigger disable/enable must run within a transaction. Test: verify that if the function errors mid-way, the trigger is re-enabled (Postgres handles this via transaction rollback). Test with both service-role and anon-role clients. Verify bulk UPDATE/DELETE is also blocked.

---

### Batch 2: Backend Performance + Data Fixes (Parallel)

Can run in parallel after Batch 0. Independent of Batch 1.

#### 153 - Persist Sensitivity Settings
- **Priority:** P2 | **Effort:** 2-3h | **Risk:** Low
- **Files to modify:**
  - `packages/backend/src/services/wellness/BurnoutScoringService.ts` (line 51, replace Map with DB-backed store)
  - Supabase migration (add column or table)
- **Approach:** Option 2 (JSON column on existing table) -- faster, no new table:
  1. Add `sensitivity_level` column to `creator_wellness_preferences` table (or equivalent) as VARCHAR with default 'medium'.
  2. On `setSensitivity(creatorId, level)`: write to DB, update in-memory cache.
  3. On `getSensitivity(creatorId)`: check in-memory cache first, fallback to DB read, cache result.
  4. Replace `private sensitivitySettings = new Map<>()` with a simple cache + DB pattern:
     ```typescript
     private sensitivityCache = new Map<string, { level: SensitivityLevel; expiresAt: number }>();
     private readonly CACHE_TTL = 5 * 60 * 1000; // 5 min
     ```
  5. On `getSensitivity`: if cached and not expired, return cache. Otherwise read from DB, cache, return.
- **Risks:** Migration required. Cache invalidation on multi-instance deploys (acceptable for P2 -- sensitivity changes are rare).

#### 155 - Optimize Fingerprint Compare
- **Priority:** P2 | **Effort:** 1-2h | **Risk:** Medium
- **Files to modify:**
  - `packages/backend/src/services/provenance/FingerprintService.ts` (lines 147-158)
- **Approach:** Option 2 (batch with limit) -- pragmatic for P2:
  1. Add time-window filter: only compare against fingerprints from last 90 days by default. **Window is configurable** via parameter with fallback to env var `FINGERPRINT_COMPARE_WINDOW_DAYS=90`.
  2. Add LIMIT clause: return top 20 most similar matches.
  3. Add creator_id filter if the comparison is for a specific creator's content.
  4. Query becomes: `supabase.from('content_fingerprints').select('*').gte('created_at', ninetyDaysAgo).limit(1000)` then compare in-app.
  5. **Accuracy preservation (PO concern #6):** The optimization MUST NOT introduce false negatives within the time window. Same fingerprints that matched before must still match. To verify: write a test that creates known-similar fingerprints within the window and confirms they are found. The only fingerprints that will no longer match are those older than the time window -- this is an accepted, documented tradeoff.
  6. **Fallback for full-scan:** Add an optional `fullScan: boolean` parameter that bypasses the time window for admin/DMCA investigation use cases. Default is `false`.
  7. Future: Move to Postgres extension for similarity search (pgvector or custom hamming index). Out of scope for this sprint.
- **Risks:** May miss duplicates older than the window. Configurable window and fullScan fallback mitigate this. The 1000-row cap is a reasonable bound for the time window.

#### 163 - Parallelize Sequential DB Queries
- **Priority:** P3 | **Effort:** 30 min | **Risk:** Low
- **Files to modify:**
  - `packages/backend/src/services/wellness/WellnessService.ts`
- **Approach:**
  1. Identify sequential `await` calls that are independent (e.g., fetching snapshots, scores, and settings in series).
  2. Wrap in `Promise.all()`:
     ```typescript
     const [snapshots, scores, settings] = await Promise.all([
       this.getSnapshots(creatorId),
       this.getScores(creatorId),
       this.getSettings(creatorId),
     ]);
     ```
  3. Only parallelize truly independent queries. Keep sequential any that depend on prior results.
  4. **Use `Promise.allSettled()` instead of `Promise.all()`** per PO requirement -- if one query fails, the dashboard can still show partial results from successful queries. Handle each result's `status === 'fulfilled'` vs `'rejected'` individually.
- **Risks:** Partial dashboard rendering requires UI to handle missing sections gracefully. Frontend must show per-section error states.

#### 165 - Bound Pulse History Query
- **Priority:** P3 | **Effort:** 30 min | **Risk:** Low
- **Files to modify:**
  - `packages/backend/src/services/wellness/WellnessService.ts` (pulse history method)
  - `packages/backend/src/routes/v2/wellness.routes.ts` (add query params)
- **Approach:**
  1. Add `limit` (default 50) and `offset` (default 0) parameters to the pulse history service method.
  2. Apply `.limit(limit).range(offset, offset + limit - 1)` to the Supabase query.
  3. Return count header or metadata for frontend pagination.
  4. Update route handler to parse `?limit=50&offset=0` query params with validation (max limit: 200).
- **Risks:** None. Additive change.

#### 166 - Remove Unreachable at_threshold Branch
- **Priority:** P3 | **Effort:** 5 min | **Risk:** Low
- **Files to modify:**
  - `packages/backend/src/services/wellness/ScheduleService.ts` (lines 142-147)
- **Approach:**
  1. Remove the `case 'at_threshold':` block entirely.
  2. Verify no references to 'at_threshold' string literal exist anywhere in codebase.
  3. **Ensure the `default:` case handles unexpected values gracefully** per PO requirement -- log a warning and return a safe fallback rather than silently doing nothing.
- **Risks:** None. Dead code removal with defensive default.

---

### Batch 3: Frontend Fixes (Parallel)

Can run in parallel after Batch 0 (specifically after 158 completes). Independent of Batches 1-2.

#### 159 - Add Missing Frontend API Methods
- **Priority:** P2 | **Effort:** 1-2h | **Risk:** Low
- **Depends on:** 158 (needs correct shared types)
- **Files to modify:**
  - `packages/frontend/src/features/wellness/services/wellnessApi.ts`
  - `packages/frontend/src/features/content-shield/services/shieldApi.ts`
- **Approach:**
  1. Add 3 methods to wellness API client:
     - `getBenchmarks(creatorId)` -- GET /api/v2/wellness/benchmarks
     - `getResourceLibrary()` -- GET /api/v2/wellness/resources
     - `getPulseHistory(creatorId, params)` -- GET /api/v2/wellness/pulse/history
  2. Add 2 methods to shield API client:
     - `getDmcaReports(creatorId)` -- GET /api/v2/shield/dmca/reports
     - `getProvenanceVerification(contentId)` -- GET /api/v2/shield/provenance/verify
  3. Create TanStack Query hooks for each: `useGetBenchmarks()`, `useGetResourceLibrary()`, `useGetPulseHistory()`, `useGetDmcaReports()`, `useGetProvenanceVerification()`
  4. Follow existing pattern in the API files for query key naming, error handling, and types.
- **Risks:** Need to verify exact backend endpoint paths and response shapes.

#### 160 - Replace Hardcoded PLACEHOLDER_CREATOR_ID
- **Priority:** P2 | **Effort:** 30 min | **Risk:** Low
- **Files to modify:**
  - `packages/frontend/src/features/content-shield/components/ShieldDashboard.tsx` (line 7)
- **Approach:**
  1. Import auth hook: `import { useAuth } from '@/features/auth';`
  2. Replace `const PLACEHOLDER_CREATOR_ID = 'current-creator'` with:
     ```typescript
     const { user, isLoading: authLoading } = useAuth();
     const creatorId = user?.nostr_pubkey;
     ```
  3. **Graceful unauthenticated state (PO concern #7):** Do NOT just swap the constant. Add proper state handling:
     ```typescript
     if (authLoading) return <LoadingSpinner />;
     if (!creatorId) return <Navigate to="/login" state={{ from: '/shield' }} />;
     ```
     Or, if the app handles auth at the route level, show an empty state message: "Please log in to view your Content Shield dashboard."
  4. **Disable all API queries when creatorId is undefined** -- use TanStack Query's `enabled: !!creatorId` option to prevent API calls with undefined/null IDs.
  5. Grep for other hardcoded creator IDs in Phase 7 frontend code to ensure none remain (`PLACEHOLDER`, `current-creator`, `test-creator`, etc.).
- **Risks:** Need to verify the auth hook export path. Pattern already used in other dashboards (e.g., `CreatorDashboard.tsx` uses `useAuth()`).

#### 164 - Add useMemo to WellnessTrend
- **Priority:** P3 | **Effort:** 15 min | **Risk:** Low
- **Files to modify:**
  - `packages/frontend/src/features/wellness/components/WellnessTrend.tsx` (lines 59-68)
- **Approach:**
  1. Wrap the data transformation in `useMemo`:
     ```typescript
     const trendData = useMemo(() => {
       // existing transformation logic
     }, [data]); // or whatever the input dependency is
     ```
  2. Import `useMemo` from React if not already imported.
- **Risks:** None.

#### 167 - Fix Division by Zero in BoundarySettings
- **Priority:** P3 | **Effort:** 5 min | **Risk:** Low
- **Files to modify:**
  - `packages/frontend/src/features/wellness/components/BoundarySettings.tsx` (lines 76-79)
- **Approach:**
  1. Handle null/undefined/zero per PO requirement:
     ```typescript
     const safeMax = Number(max) || 0;
     const safeCurrent = Number(current) || 0;
     const percentage = safeMax > 0
       ? Math.min(Math.max((safeCurrent / safeMax) * 100, 0), 100)
       : 0;
     ```
  2. This handles: zero, undefined, null, NaN. Clamps result to 0-100 range (no >100% display).
- **Risks:** None.

#### 168 - XSS Sanitization for auto_response_template
- **Priority:** P3 | **Effort:** 30 min | **Risk:** Low
- **Files to modify:**
  - `packages/backend/src/validators/wellness.ts` (input sanitization)
  - Any frontend component rendering auto_response_template
- **Approach:**
  1. **Backend input validation:** In the Zod validator for boundary creation/update:
     - **Preferred (PO note #4):** Use `sanitize-html` library with an empty allowlist (`allowedTags: []`) to strip ALL HTML. This handles encoded entities, malformed tags, event handlers, and Unicode tricks that regex misses.
     - **Fallback (if no new dependency desired for P3):** Two-pass regex -- decode HTML entities first (`he` library or manual `&lt;` -> `<`), then strip tags with `/<[^>]*>/g`, then reject inputs with suspicious patterns (`on\w+=`, `javascript:`)
     - Apply as Zod `.transform()` on the `auto_response_template` field
  2. **Frontend output:** Ensure any rendering of `auto_response_template` uses text interpolation (`{template}` in JSX) not `dangerouslySetInnerHTML`. React's default JSX escaping handles this, but verify no component uses `dangerouslySetInnerHTML` for templates.
  3. **Existing data:** Add a migration to sanitize existing records: `UPDATE creator_boundaries SET auto_response_template = regexp_replace(auto_response_template, '<[^>]*>', '', 'g') WHERE auto_response_template ~ '<[^>]*>';`
  4. **Preserve legitimate text:** Sanitization must not corrupt normal messages. Test with messages containing `<3`, `>50%`, angle brackets in math/comparisons. The regex `<[^>]*>` only matches paired angle brackets with content, so `<3` (no closing `>`) is safe.
- **Risks:** If templates intentionally contain formatting (bold, links), stripping HTML would remove it. For P3 scope, plain text is acceptable.

---

## Execution Timeline

```
Time    Batch 0 (Foundation)     Batch 1 (Security)      Batch 2 (Perf/Data)     Batch 3 (Frontend)
─────   ────────────────────     ──────────────────      ───────────────────      ──────────────────
T+0     157: SupabaseClient      (blocked)               (blocked)               158: Type dedup
T+0.5   161: ILogger typing      (blocked)               (blocked)               (blocked on 158)
T+1     --- BATCH 0 DONE ---     152: Rate limits        153: Persist settings   159: API methods
T+1     --- BATCH 0 DONE ---     154: Benchmark fix      155: Fingerprint opt    160: Auth fix
T+1     --- BATCH 0 DONE ---     156: RLS fix            163: Parallel queries   164: useMemo
T+1     --- BATCH 0 DONE ---     162: Immutability       165: Pagination         167: Div by zero
T+1     --- BATCH 0 DONE ---                             166: Dead code          168: XSS fix
```

**Batch 0** runs first (sequential: 157 then 161 backend, 158 frontend can start in parallel).
**Batches 1, 2, 3** run in parallel after Batch 0 completes.

---

## Cross-Domain Coordination Points

1. **157/158 Shared Types:** Backend SupabaseClient consolidation (157) and frontend type dedup (158) both deal with type duplication but in different packages. No conflict -- can run in parallel.

2. **159 Backend Endpoint Contracts:** Frontend API methods (159) need to match backend endpoint signatures. The backend endpoints already exist in v2 routes. Frontend developer should read the route files to get exact paths and response types.

3. **156/168 Boundary Data Model:** RLS fix (156) and XSS sanitization (168) both touch the `creator_boundaries` table. 156 is a DB policy change; 168 is input validation + migration. No conflict, but the migration files should be numbered correctly.

4. **152/165 Route File Coordination (PO note #5):** Rate limiting (152) and pagination (165) both modify `wellness.routes.ts`. **Assign both to the same backend agent** to avoid merge conflicts. If different agents, explicitly sequence 152 before 165 -- 152 adds router-level middleware, then 165 adds query params to specific routes.

---

## Parallel Execution Groups for `/resolve_todo_parallel`

### Group A: Backend Foundation (Sequential)
```
157 → 161
```

### Group B: Backend Security (Parallel, after Group A)
```
152, 154, 156, 162
```

### Group C: Backend Performance (Parallel, after Group A)
```
153, 155, 163, 165, 166
```

### Group D: Frontend Foundation (Sequential)
```
158 → 159
```

### Group E: Frontend Quick Fixes (Parallel, after Group D)
```
160, 164, 167, 168
```

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Migration conflicts between 153, 154, 156, 162 | Number migrations sequentially: 156 -> 162 -> 154 -> 153 |
| Rate limit values too strict for wellness check-ins | Start with generous limits (100/min reads), monitor and tighten |
| Frontend type dedup breaks components | Run `tsc --noEmit` after changes to catch compile errors |
| Fingerprint optimization misses older duplicates | Configurable time window (90d default) + fullScan fallback for admin |
| Provenance immutability blocks legitimate revocation | Status-column-only UPDATE exception in trigger |
| Provenance trigger bypassed by service-role | Triggers fire regardless of RLS bypass -- verified |
| Benchmark leaks individual scores with small N | Anonymity threshold: benchmarks only returned when N >= 5 creators |
| Rate limiting fails for unauthenticated users | Existing middleware defaults to IP-based keying |
| Hardcoded creator ID swap breaks unauthenticated flow | Full auth state handling: loading, redirect, empty state |

---

## PO Concern Resolution Matrix

### Initial 7 Concerns (v2)

| # | PO Concern | Resolution | Plan Section |
|---|-----------|------------|--------------|
| 1 | Security fixes need DB migrations early | 156, 162 in Batch 1 (first parallel batch). Migrations numbered sequentially. | Dependency Rules #5 |
| 2 | Provenance trigger must block service-role | Postgres triggers fire regardless of RLS bypass. Trigger explicitly blocks all roles. | Fix 162 approach |
| 3 | Benchmark anonymity threshold (N < 5) | SQL function returns NULL when fewer than 5 distinct creators. Service returns `sufficient_data: false`. | Fix 154 approach |
| 4 | Rate limiting for unauthenticated requests | Existing `createUserRateLimiter` falls back to `req.ip` when no auth token. Used for mutation routes. | Fix 152 approach |
| 5 | Type dedup order (157 before 158) | 157 (backend) and 158 (frontend) can run in parallel -- different packages, no cross-dep. Clarified in dependency rules. | Dependency Rules #4 |
| 6 | Fingerprint accuracy preservation | No false negatives within time window. Configurable window + `fullScan` parameter for admin use. Test required. | Fix 155 approach |
| 7 | Frontend auth handling -- graceful unauth state | Loading spinner, login redirect, disabled queries when `!creatorId`. Grep for other hardcoded IDs. | Fix 160 approach |

### PO Approval Notes (v3 -- plan APPROVED)

| # | PO Note | Resolution | Plan Section |
|---|---------|------------|--------------|
| 1 | 152: Verify rate limiter keys on user ID vs IP | Already addressed: `createUserRateLimiter` uses `user?.nostr_pubkey \|\| req.ip`. Implementer should verify. | Fix 152 approach step 2 |
| 2 | 154: Anonymity threshold missing from SQL | Already addressed in v2: SQL function checks `COUNT(DISTINCT creator_id) < 5`. | Fix 154 approach step 2 |
| 3 | 162: Column-level trigger exception is fragile | Updated to PO's cleaner pattern: trigger blocks everything, separate `SECURITY DEFINER` function with trigger disable/enable for revocation. Only service_role can call it. | Fix 162 approach (v3) |
| 4 | 168: Regex too simplistic for XSS | Updated: recommend `sanitize-html` library (empty allowlist). Regex is fallback only. | Fix 168 approach step 1 |
| 5 | 152/165: Same route file conflict | Updated: assign both to same backend agent. If different agents, sequence 152 before 165. | Cross-Domain Coordination #4 |

---

## Acceptance Criteria Summary

Each fix has its own acceptance criteria in the todo file. The sprint-level criteria are:

1. All 17 todo items resolved (status changed from `pending` to `resolved`)
2. No new P1 or P2 issues introduced (verified by post-implementation review)
3. All existing tests continue to pass
4. TypeScript compilation succeeds (`tsc --noEmit`)
5. Rate limiting functional on all v2 endpoints
6. No data leaks in benchmark or boundary queries
7. Provenance records immutable at database level
8. Frontend types sourced from shared package
9. All frontend API methods present for 100% backend coverage
