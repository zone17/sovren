---
module: System
date: 2026-02-16
problem_type: code_quality
component: service_object
symptoms:
  - "8x duplicated SupabaseClient interface across Phase 7 services"
  - "No rate limiting on 24 v2 endpoints"
  - "RLS policy SELECT USING (TRUE) exposes creator boundaries to all users"
  - "In-memory Map for sensitivity settings lost on server restart"
  - "FingerprintService O(n) linear scan for fingerprint matching"
  - "Frontend type duplication ~339 lines duplicating shared package"
  - "Hardcoded PLACEHOLDER_CREATOR_ID in Shield dashboard"
  - "Logger typed as Function instead of proper interface"
  - "Provenance records can be updated/deleted (no immutability)"
  - "XSS in auto_response_template stored/rendered without sanitization"
resolution_type: code_fix
root_cause: code_quality
severity: high
tags: [p2-p3-remediation, phase-7, pr-82, rate-limiting, rls, immutability, type-safety, performance, xss, supabase, team-builder-enterprise]
---

# Troubleshooting: 17 P2/P3 Findings in Phase 7 Creator Safety Net

## Problem

Phase 7 PR #82 (90 new files, 24 endpoints) had 5 P1 critical bugs fixed first (todos 147-151), leaving 17 P2/P3 findings (todos 152-168) across security, data persistence, TypeScript quality, performance, and frontend coverage. These were caught during post-sprint `/workflows:review` with 8+ parallel review agents.

## Environment
- Module: WellnessService, BurnoutScoringService, FingerprintService, ProvenanceService, AlertService, ScheduleService, BoundaryService, DmcaService + frontend features
- Stack: Node.js + TypeScript + Supabase + React 18 + TanStack Query
- Affected: `packages/backend/src/services/`, `packages/frontend/src/features/`, `supabase/migrations/`
- Date: 2026-02-16

## Symptoms

### Security (4 fixes)
- **152**: No rate limiting on any of 24 v2 endpoints — vulnerable to abuse/DoS
- **156**: RLS policy `SELECT USING (TRUE)` on `creator_boundaries` — any user reads any creator's boundaries
- **162**: Provenance records have no immutability enforcement — can be updated/deleted
- **168**: `auto_response_template` stored and rendered without HTML sanitization — XSS vector

### Data/Persistence (2 fixes)
- **153**: `sensitivitySettings = new Map<>()` in BurnoutScoringService — lost on restart
- **154**: `getBenchmark()` does `select('*')` on all wellness_snapshots — full table scan + data leak across creators

### TypeScript Quality (3 fixes)
- **157**: `interface SupabaseClient { from(); rpc(); }` duplicated verbatim in 8 service files
- **158**: ~339 lines of type definitions in frontend duplicating `@sovren/shared` types
- **161**: Logger typed as `{ info: Function; error: Function; warn: Function }` in 8 services

### Performance (4 fixes)
- **155**: FingerprintService.compare() scans ALL fingerprints with O(n) complexity
- **163**: Sequential `await` calls on independent DB queries in WellnessService
- **165**: Unbounded pulse history query with no pagination — returns all records
- **166**: Unreachable `case 'at_threshold':` dead code in ScheduleService

### Frontend Coverage (2 fixes)
- **159**: 5 backend endpoints missing corresponding frontend API methods
- **160**: Hardcoded `PLACEHOLDER_CREATOR_ID = 'current-creator'` in ShieldDashboard

### Edge Cases (2 fixes)
- **164**: Missing `useMemo` on expensive data transformation in WellnessTrend
- **167**: Division by zero when max boundary value is 0 in BoundarySettings

## Solution

### Sprint Organization: Enterprise Tier Team-Builder

Used `/team-builder enterprise` with 5 phases:
- **Phase 0**: Skipped (infrastructure already exists — 9 CI workflows, Sentry, Trivy)
- **Phase 1**: Architect + Product-Owner — plan + DoD with 30 new acceptance criteria
- **Phase 2**: Backend (11 fixes) + Frontend (6 fixes) in parallel
- **Phase 3**: QA verification + Security audit in parallel
- **Phase 4**: 6 parallel code review agents (security, architecture, TypeScript, data integrity, simplicity, patterns)

### Execution Batches (from Architect's Plan)

```
Batch 0 (Foundation, Sequential): 157→161 (backend), 158 (frontend parallel)
Batch 1 (Backend Security, Parallel): 152, 154, 156, 162
Batch 2 (Backend Performance, Parallel): 153, 155, 163, 165, 166
Batch 3 (Frontend, After 158): 159→160, 164, 167, 168
```

### Key Implementation Patterns

**ISupabaseClient Consolidation (157):**
```typescript
// packages/backend/src/interfaces/shared/ISupabaseClient.ts
export interface ISupabaseClient {
  from(table: string): any;
  rpc(fn: string, params?: Record<string, unknown>): any;
}
```
All 8 services import from shared interface instead of defining locally.

**Rate Limiting (152):**
```typescript
// Tiered rate limits using existing middleware
router.use(readOnlyRateLimiter);              // 100/min baseline
router.post('/pulse', contentCreationRateLimiter, ...);  // 10/min mutations
router.get('/benchmark', expensiveOperationRateLimiter, ...);  // 20/min expensive
```

**RLS Fix (156):**
```sql
DROP POLICY IF EXISTS "select_creator_boundaries" ON creator_boundaries;
CREATE POLICY "select_own_boundaries" ON creator_boundaries
  FOR SELECT USING (creator_id = auth.uid());
```

**Provenance Immutability (162):**
```sql
CREATE TRIGGER enforce_provenance_immutability
  BEFORE UPDATE OR DELETE ON provenance_records
  FOR EACH ROW EXECUTE FUNCTION prevent_provenance_modification();
-- Trigger fires for ALL roles including service-role
```

**Sensitivity Persistence (153):**
```typescript
// Replace: private sensitivitySettings = new Map<string, SensitivityLevel>();
// With: DB column + TTL cache
private sensitivityCache = new Map<string, { level: SensitivityLevel; expiresAt: number }>();
```

**Frontend Type Dedup (158):**
```typescript
// Before: 189 lines of duplicated type definitions
// After: re-export from shared
export type { WorkPattern, PulseCheckIn, ... } from '@sovren/shared/types/wellness';
// Keep frontend-only types local
export interface WellnessDashboardState { ... }
```

## Changes Summary

- **30 files changed**: +654 lines, -360 lines (net +294)
- **4 SQL migrations** created for RLS, immutability triggers, benchmark RPC, sensitivity column
- **8 services** refactored for ISupabaseClient + ILogger
- **~339 lines** of duplicated frontend types removed
- **24 v2 endpoints** now rate-limited
- **5 frontend API methods** + TanStack Query hooks added
- **6 commits** in logical batches

## Why This Works

1. **Batch ordering prevents conflicts**: 157 (shared interface) must complete before touching same files for other fixes. The architect's dependency graph caught this.
2. **DB-level enforcement**: RLS policies and triggers execute regardless of application code, providing defense-in-depth against bypass.
3. **Type dedup via re-exports**: Frontend imports from `@sovren/shared` ensure single source of truth. Frontend-only types remain local.
4. **Centralized rate limiting**: Middleware presets in one file, applied at route level. No limit definitions scattered across route handlers.

## Prevention

### Gate Improvements Already Applied (from P1 sprint)
- Gate 2 checks 7-12 already cover: route mounting, error handling, transactions, in-memory Maps, concurrency, type safety
- These P2/P3 items were lower-severity variants of the same patterns

### Additional Prevention for P2/P3 Patterns

| Finding Type | Prevention | Tooling |
|-------------|------------|---------|
| Interface duplication | Grep for duplicate `interface` blocks across service files | ESLint custom rule or pre-commit grep |
| Missing rate limiting | Gate check: every route file must import rate limiter | Grep for `router.` without `rateLimiter` |
| RLS too permissive | Review migration for `USING (TRUE)` patterns | SQL linter or migration review checklist |
| In-memory persistence | Gate check: grep for `new Map()` storing business data | Already in Gate 2 check 11 |
| Full table scans | Review `.select('*')` without `.limit()` or RPC aggregation | Performance review agent |
| Frontend type duplication | Compare frontend types with `@sovren/shared` in CI | tsc path analysis or custom script |
| Missing API methods | Compare frontend API client methods with backend routes | Agent-native review checks this |
| Hardcoded IDs | Grep for `PLACEHOLDER` or `current-creator` in frontend | Pre-commit hook |

### Team-Builder Learnings

1. **Enterprise tier handles security-critical sprints well**: The QA + security-audit parallel in Phase 3 caught implementation details the backend agent missed
2. **Architect's dependency graph is critical for batch ordering**: Without it, 157/161 could have caused merge conflicts with other fixes
3. **Product-owner's 30 new acceptance criteria improved fix quality**: Edge cases like "service-role bypass" and "anonymity threshold" were caught before implementation
4. **Phase 0 skip saves ~$1.26**: When infrastructure exists, marking Phase 0 complete immediately is the right call
5. **Frontend-backend coordination on pagination**: Frontend agent proactively aligned with backend's pagination contract (todo 165)

## Related Issues

- See also: [p1-behavioral-bugs-phase7-pr82-20260216.md](../logic-errors/p1-behavioral-bugs-phase7-pr82-20260216.md) — 5 P1 fixes from same PR
- See also: [structural-gates-miss-behavioral-p1s-team-builder-20260215.md](../workflow-issues/structural-gates-miss-behavioral-p1s-team-builder-20260215.md) — Gate improvements
- See also: [p2-remediation-sprint-25-findings.md](../security-issues/p2-remediation-sprint-25-findings.md) — Prior P2 remediation (PR #73)
- See also: [p1-critical-fixes-pr73-round4.md](../security-issues/p1-critical-fixes-pr73-round4.md) — Prior P1 fixes (PR #73)
