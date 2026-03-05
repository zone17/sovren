---
title: 'feat: Shield + Business Advanced (Slice 7)'
type: feat
date: 2026-03-04
squad: A
sprint: S3
branch: feat/squad-a/S3-shield-business-advanced
---

# Slice 7: Shield + Business Advanced

## Overview

Align database schema with existing service code, add the only net-new backend component (BullMQ burnout refresh processor), improve tax exports, and expand E2E coverage. **~80% of this slice is a migration + integration validation** — the services, routes, hooks, and UI components are already built.

## Problem Statement

All Slice 7 features (burnout scoring, scheduling recommendations, creator boundaries, wellness pulse) were implemented at the service/route/hook/component level in prior sprints. However, the database schema in `supabase/migrations/` doesn't include the columns these services read and write. This means:

- `BoundaryService.updateBoundaries()` writes to columns that don't exist (`focus_hours_enabled`, `dnd_active`, etc.)
- `WellnessService.recordPulse()` inserts `energy`, `motivation`, `stress` into a table that lacks those columns
- `BurnoutScoringService.calculateScore()` upserts on `creator_id,week` — but `week` column and UNIQUE constraint don't exist
- The daily batch burnout refresh job has no processor implementation

## Proposed Solution

Three phases executed sequentially:

1. **Phase 1: Database Migration** — Add missing columns to 3 tables (`wellness_benchmarks` cut — unused by Slice 7)
2. **Phase 2: Backend Fixes + BullMQ Processor** — Fix `dnd_active` write path, pulse guard, create burnout refresh processor + DI + bootstrap, improve tax export
3. **Phase 3: Tests** — Backend unit tests + Playwright E2E

## Technical Approach

### Phase 1: Database Migration

**New file**: `supabase/migrations/20260305000000_slice7_wellness_schema_gaps.sql`

All DDL is idempotent (`ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`).

#### 1a. `creator_boundaries` — 12 new columns

| Column                          | Type    | Default    | Constraint                                               |
| ------------------------------- | ------- | ---------- | -------------------------------------------------------- |
| `focus_hours_enabled`           | BOOLEAN | `false`    | —                                                        |
| `focus_hours_start`             | TEXT    | `'22:00'`  | —                                                        |
| `focus_hours_end`               | TEXT    | `'08:00'`  | —                                                        |
| `focus_hours_timezone`          | TEXT    | `'UTC'`    | —                                                        |
| `focus_hours_days`              | TEXT[]  | `'{}'`     | —                                                        |
| `weekly_engagement_budget_mins` | INTEGER | `0`        | `>= 0`                                                   |
| `dnd_active`                    | BOOLEAN | `false`    | —                                                        |
| `auto_response_enabled`         | BOOLEAN | `false`    | —                                                        |
| `auto_response_template`        | TEXT    | `''`       | `length <= 500`                                          |
| `availability_status`           | TEXT    | `'hidden'` | `CHECK (IN ('hidden','available','creating','offline'))` |
| `availability_public`           | BOOLEAN | `false`    | —                                                        |
| `notification_batching`         | BOOLEAN | `false`    | —                                                        |

**Note**: `sensitivity_level` already exists. `weekly_engagement_budget_mins` is new (the old table only had `max_daily_hours`, `max_weekly_hours`, `break_reminder_interval_mins`, `quiet_hours_start`, `quiet_hours_end`).

#### 1b. `wellness_snapshots` — 3 new columns

| Column       | Type    | Default | Constraint                           |
| ------------ | ------- | ------- | ------------------------------------ |
| `energy`     | INTEGER | `NULL`  | `CHECK (energy BETWEEN 1 AND 5)`     |
| `motivation` | INTEGER | `NULL`  | `CHECK (motivation BETWEEN 1 AND 5)` |
| `stress`     | INTEGER | `NULL`  | `CHECK (stress BETWEEN 1 AND 5)`     |

Columns are **nullable** — existing rows are old-format snapshots, not pulse check-ins. New rows from `recordPulse()` always supply all three. Index: `idx_wellness_snapshots_creator_id` on `(creator_id)`.

#### 1c. `burnout_risk_history` — 3 new columns + UNIQUE constraint

| Column  | Type    | Default | Constraint                                        |
| ------- | ------- | ------- | ------------------------------------------------- |
| `week`  | TEXT    | `NULL`  | —                                                 |
| `score` | INTEGER | `NULL`  | `CHECK (score BETWEEN 0 AND 100)`                 |
| `level` | TEXT    | `NULL`  | `CHECK (IN ('low','moderate','high','critical'))` |

**Strategy**: Add new columns alongside existing `risk_score`/`risk_level` (non-destructive). Service already writes to `score`/`level`/`week`. Add `UNIQUE(creator_id, week)` constraint for upsert. Backfill existing rows if needed:

```sql
UPDATE burnout_risk_history SET score = ROUND(risk_score), level = risk_level WHERE score IS NULL AND risk_score IS NOT NULL;
```

#### ~~1d. `wellness_benchmarks`~~ — CUT

No Slice 7 code reads `avg_weekly_hours`, `p25_hours`, `p50_hours`, `p75_hours`. Deferred to a slice that needs benchmark data.

```mermaid
erDiagram
    creator_boundaries {
        uuid id PK
        uuid creator_id UK
        boolean focus_hours_enabled
        text focus_hours_start
        text focus_hours_end
        text focus_hours_timezone
        text_arr focus_hours_days
        integer weekly_engagement_budget_mins
        boolean dnd_active
        boolean auto_response_enabled
        text auto_response_template
        text availability_status
        boolean availability_public
        boolean notification_batching
        varchar sensitivity_level
    }
    wellness_snapshots {
        uuid id PK
        uuid creator_id FK
        numeric composite_score
        integer energy
        integer motivation
        integer stress
        text "UNIQUE(creator_id, DATE(created_at))"
    }
    burnout_risk_history {
        uuid id PK
        uuid creator_id FK
        text week
        integer score
        text level
        jsonb factors
        text "UNIQUE(creator_id, week)"
    }
```

### Phase 2: Backend Fixes + BullMQ Processor

#### 2a. Fix `dnd_active` write path in BoundaryService

**File**: `packages/backend/src/services/wellness/BoundaryService.ts`

`updateBoundaries()` currently maps `input.dnd_mode.auto_response_enabled` and `input.dnd_mode.auto_response_template` but **never writes `dnd_active`**. Fix:

```typescript
// BoundaryService.ts:85-88 — add dnd_active to payload
if (input.dnd_mode) {
  payload.dnd_active = input.dnd_mode.active; // <-- ADD THIS
  payload.auto_response_enabled = input.dnd_mode.auto_response_enabled;
  payload.auto_response_template = input.dnd_mode.auto_response_template;
}
```

This is a **bug fix** — the DND toggle currently loses state on page refresh.

#### 2b. BurnoutRefreshProcessor (NET-NEW)

**New file**: `packages/backend/src/services/wellness/BurnoutRefreshProcessor.ts`

Per ADR-019 conventions:

- **Queue name**: `burnout-scoring` (matches roadmap table)
- **Processor name**: `burnout-daily-refresh`
- **Concurrency**: `3` (moderate — 4 DB queries per creator)
- **Design**: Single repeatable job iterates all active creators internally. Per-creator try/catch for error isolation.
- **Active creators query**: `SELECT DISTINCT creator_id FROM creator_work_patterns WHERE date >= NOW() - INTERVAL '30 days'` — skips inactive creators and those without enough data
- **Retry**: 3 attempts, exponential backoff from 5s (ADR-019 default)
- **Job ID**: `burnout-refresh-daily` (stable — prevents duplicate repeatable jobs)
- **Schedule**: `repeat: { pattern: '0 2 * * *' }` (2 AM UTC daily)

```typescript
// BurnoutRefreshProcessor.ts (skeleton)
export interface BurnoutRefreshJobData {
  triggeredBy: 'cron' | 'manual';
}

export class BurnoutRefreshProcessor implements IJobProcessor<BurnoutRefreshJobData> {
  readonly name = 'burnout-daily-refresh';
  readonly queueName = 'burnout-scoring';
  readonly concurrency = 1; // Single job iterates creators sequentially

  constructor(
    private readonly burnoutService: IBurnoutScoringService,
    private readonly db: ISupabaseClient,
    private readonly logger: ILogger
  ) {}

  async process(job: JobContext<BurnoutRefreshJobData>): Promise<void> {
    // 1. Query active creators (posted in last 30 days)
    // 2. For each creator: try { await calculateScore(creatorId) } catch { log + continue }
    // 3. Log summary: { total, succeeded, failed }
  }

  async onFailed(job: JobContext<BurnoutRefreshJobData>, error: Error): Promise<void> {
    this.logger.error('[BurnoutRefreshProcessor] Daily refresh failed', {
      error: error.message,
      attempts: job.attemptsMade,
    });
  }
}
```

**Registration**: Add to `phase7.bindings.ts` using `asDb()` wrapper. Update `types.ts` with `SERVICE_DEPENDENCIES`, `SERVICE_LIFETIMES`, `SERVICE_TAGS`. Schedule repeatable job in `bootstrap.ts` after Phase 3 (container creation, ~line 147).

**No feature flag** — register unconditionally like `CrossPublishProcessor`. Guard with `if (!process.env.REDIS_URL)` only.

#### 2c. Tax Export Improvements

**File**: `packages/backend/src/services/finance/TaxService.ts`

Two changes to `exportTaxReport()`:

1. **Add annual total row** — appended after quarterly summary: `Annual,{totalRevenue},{totalExpenses},{totalNet},{totalUsdRevenue},{totalUsdExpenses},{totalUsdNet}`
2. **Remove 100-row limit on export** — new private method `getExpensesForExport(creatorId, startDate, endDate)` using paginated accumulation (PAGE_SIZE=500 loop) instead of `getExpenses()` with `.limit(100)` for the export path only. The UI list endpoint keeps its limit.
3. **JSON export** — add `annualTotal` object alongside existing `quarters` and `expenses`

**Deferred**: Revenue rows section and rate provenance columns — not required by DoD.

#### 2d. Wellness Pulse Frequency Guard

**File**: `packages/backend/src/services/wellness/WellnessService.ts` (service layer, NOT route handler)

Add `checkPulseEligibility(creatorId)` to `WellnessService`:

```typescript
// WellnessService — service-layer abstraction (matches existing route→service pattern)
async checkPulseEligibility(creatorId: string): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0];
  const { count } = await this.db.from('wellness_snapshots')
    .select('*', { count: 'exact', head: true })
    .eq('creator_id', creatorId)
    .gte('created_at', `${today}T00:00:00Z`);
  return (count || 0) < 1;
}
```

Route handler calls the service method; DB-level `UNIQUE(creator_id, DATE(created_at))` from T1 is the TOCTOU-safe backstop.

### Phase 3: Tests + E2E

#### 3a. Integration Tests for BurnoutRefreshProcessor

**New file**: `packages/backend/src/services/wellness/__tests__/BurnoutRefreshProcessor.test.ts`

Tests:

- Processor metadata (`name`, `queueName`, `concurrency`)
- `process()` fetches active creators and calls `calculateScore()` for each
- Per-creator error isolation — one failure doesn't stop the batch
- Empty creator list — job completes with 0 processed
- `onFailed()` logs error with attempt count

#### 3b. Tax Export Improvement Tests

**File**: `packages/backend/src/services/finance/__tests__/TaxService.test.ts` (extend existing)

Tests:

- CSV includes revenue rows section with correct column count
- CSV expense rows include `rate_source` and `rate_timestamp`
- CSV annual total row is present and sums correctly
- JSON export includes `revenues` array
- Revenue pagination handles >500 entries (mock 2 pages)
- CSV injection protection applies to revenue rows

#### 3c. BoundaryService DND Fix Test

**File**: `packages/backend/src/services/wellness/__tests__/BoundaryService.test.ts` (extend existing)

Test: `updateBoundaries({ dnd_mode: { active: true, ... } })` includes `dnd_active: true` in the upsert payload.

#### 3d. E2E Test Expansion

**File**: `packages/frontend/e2e/wellness.auth.spec.ts` (extend existing)

New tests:

- **Pulse submission**: Open modal → adjust sliders → submit → verify success toast
- **Boundary persistence**: Change focus hours → save → reload page → verify values persisted
- **Burnout gauge data state**: Verify gauge shows score OR "building baseline" message
- **Schedule recommendations visible**: Verify recommended posts/week is rendered

**File**: `packages/frontend/e2e/business.auth.spec.ts` (extend existing)

New tests:

- **Tax export CSV**: Click export → verify download triggers (cannot verify file content in E2E, but verify the button click + response)
- **Tax year selector**: Change year → verify summary updates

## Acceptance Criteria

### Functional Requirements

- [ ] Migration runs cleanly on fresh DB (`supabase db reset`) and on existing DB with data
- [ ] `GET /api/v2/wellness/risk-score` returns real score for creators with 14+ days of data
- [ ] `GET /api/v2/wellness/risk-score` returns `baseline_ready: false` for creators with <14 days
- [ ] `PUT /api/v2/wellness/boundaries` persists ALL fields including `dnd_active`
- [ ] `GET /api/v2/wellness/boundaries` returns persisted values after page reload
- [ ] `POST /api/v2/wellness/pulse` records energy/motivation/stress and returns composite score
- [ ] `POST /api/v2/wellness/pulse` returns 409 if already submitted today (service-layer check + DB UNIQUE constraint)
- [ ] `GET /api/v2/wellness/schedule/recommendations` returns posting cadence data
- [ ] `GET /api/v2/business/tax/export?format=csv` includes annual total row
- [ ] `GET /api/v2/business/tax/export?format=csv` exports all expenses (no 100-row cap)
- [ ] `GET /api/v2/business/tax/export?format=json` includes `annualTotal` object
- [ ] BurnoutRefreshProcessor runs daily at 2 AM UTC and refreshes scores for active creators
- [ ] BurnoutRefreshProcessor continues processing when individual creator scoring fails

### Non-Functional Requirements

- [ ] Migration is idempotent (`ADD COLUMN IF NOT EXISTS` on all DDL)
- [ ] Tax export uses paginated accumulation (PAGE_SIZE=500) for expense rows
- [ ] Auto-response template capped at 500 chars (DB constraint)
- [ ] All new code is TypeScript strict (no `// @ts-nocheck`, no `any`) — except modifications within existing `@ts-nocheck` files (TaxService.ts)

### Quality Gates

- [ ] All existing wellness tests still pass
- [ ] All existing business tests still pass
- [ ] New BurnoutRefreshProcessor tests pass with 95%+ coverage
- [ ] New tax export tests pass
- [ ] E2E: `wellness.auth.spec.ts` passes (existing + new tests)
- [ ] E2E: `business.auth.spec.ts` passes (existing + new tests)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

## Dependencies & Prerequisites

- Branch: `feat/squad-a/S3-shield-business-advanced` (created from `origin/main`)
- Redis must be running for BullMQ tests (Docker)
- Supabase CLI for migration testing (`supabase db reset`)
- No cross-squad dependencies — all work is in Squad A's domain

## Risk Analysis

| Risk                             | Likelihood | Impact | Mitigation                                                                                   |
| -------------------------------- | ---------- | ------ | -------------------------------------------------------------------------------------------- |
| Migration breaks existing data   | Low        | High   | `ADD COLUMN IF NOT EXISTS`, nullable new columns, no column renames                          |
| BullMQ Redis not available in CI | Medium     | Medium | `if (!process.env.REDIS_URL)` guard. Processor tests mock the service, not Redis             |
| Tax export OOM on large datasets | Low        | Medium | Paginated accumulation (proven pattern from existing `getQuarterlySummary`)                  |
| E2E flaky due to loading states  | Medium     | Low    | Use `toBeVisible` assertions with Playwright auto-retry, buttons outside loading gates       |
| `@ts-nocheck` on TaxService.ts   | Low        | Medium | New methods written as-if strict. Full removal deferred — would require fixing all 409 lines |

## Deferred Items (Not in Slice 7)

- `engagement_used_mins` computation from `creator_work_patterns` — currently returns `0`
- Multi-line wellness trend chart (energy/motivation/stress separate lines)
- `hidden` status selectable in UI (currently system-only default)
- `ScheduleService` "not enough data" flag (currently always returns populated object)
- Buffer depth mechanism (future-dated work patterns source undefined)
- Burnout score endpoint caching (acceptable for now — batch job handles pre-computation)
- `wellness_benchmarks` table columns (`avg_weekly_hours`, `p25_hours`, `p50_hours`, `p75_hours`) — no Slice 7 code reads them
- Tax export: revenue rows section + rate provenance columns — not required by DoD
- Remove `@ts-nocheck` from TaxService.ts — requires fixing all pre-existing type errors
- Type `BurnoutScoringService.computeFactors()` `any[]` params — pre-existing tech debt
- Type `BoundaryService.payload` as `BoundaryUpsertPayload` interface — pre-existing tech debt

## DoD Coverage Matrix

Each Definition of Done item traced to the specific todos that satisfy it.

| DoD Item                                                | Status Before Slice 7                                                                                                                                     | What's Missing                                                                                                                  | Todos          |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| **Burnout risk score calculated from real data**        | Service + route + hook + UI exist. Algorithm computes 5-factor weighted score from `creator_work_patterns`.                                               | `burnout_risk_history` table lacks `week`/`score`/`level` columns + UNIQUE constraint for upsert. No daily batch refresh.       | T1, T3, T6     |
| **Scheduling recommendations based on posting history** | ScheduleService reads `creator_work_patterns` (4-week window). SustainableScheduler component renders pace/optimal days/buffer depth. Route + hook wired. | Schema for `creator_work_patterns` is complete — **no migration needed**. Needs E2E validation that data flows end-to-end.      | T8             |
| **Creator Boundaries persist across sessions**          | BoundaryService + route + hook + BoundarySettings UI all exist.                                                                                           | `creator_boundaries` table lacks 12 columns the service writes to. `dnd_active` is never written in `updateBoundaries()` (bug). | T1, T2, T7     |
| **Tax export improvements**                             | TaxService.exportTaxReport() produces CSV/JSON with quarterly summaries + expenses.                                                                       | Annual total row missing. Export expenses capped at 100 rows.                                                                   | T4, T7         |
| **BullMQ batch job (daily burnout refresh)**            | QueueService infrastructure ready. IJobProcessor pattern established. No burnout processor exists.                                                        | Net-new: BurnoutRefreshProcessor + DI registration + bootstrap scheduling.                                                      | T3, T6         |
| **Wellness Pulse stored and trended**                   | WellnessService.recordPulse() + WellnessPulseModal + WellnessTrend component exist.                                                                       | `wellness_snapshots` table lacks `energy`/`motivation`/`stress` columns. No frequency guard.                                    | T1, T2, T5, T8 |

**Product decision**: BurnoutScoringService uses 14-day minimum baseline (line 73). Roadmap says `<7 days`. **We keep 14 days** — the service is already implemented and tested with this threshold. Roadmap language was aspirational.

## Domain Experts

Each expert is a team role that can be referenced when spawning agents.

| Expert ID    | Domain                                                                 | Model  | Scope (OWN)                                                                                                                                                                                                                                                                                           | Scope (DO NOT OWN)                   |
| ------------ | ---------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `backend`    | Migration, wellness services, BullMQ processor, DI, tax export, routes | sonnet | `supabase/migrations/`, `packages/backend/src/services/wellness/`, `packages/backend/src/services/finance/TaxService.ts`, `packages/backend/src/container/`, `packages/backend/src/bootstrap.ts`, `packages/backend/src/routes/v2/wellness.routes.ts`, `packages/backend/src/utils/env-validation.ts` | Frontend, E2E tests                  |
| `qa-backend` | Backend unit + integration tests                                       | sonnet | `packages/backend/src/services/wellness/__tests__/`, `packages/backend/src/services/finance/__tests__/`, `packages/backend/src/__tests__/routes/v2/`                                                                                                                                                  | Service implementation, frontend     |
| `qa-e2e`     | Playwright E2E tests                                                   | sonnet | `packages/frontend/e2e/`, `packages/frontend/e2e/pages/`                                                                                                                                                                                                                                              | Backend code, service implementation |

## Atomic Todos (1 point each)

### Phase 1: Database Migration

---

**T1: Write migration SQL for 3 wellness tables**

- **Expert**: `backend`
- **File**: `supabase/migrations/20260305000000_slice7_wellness_schema_gaps.sql`
- **DoD items**: Burnout score, Boundaries, Pulse
- **Spec**:
  - Add 12 columns to `creator_boundaries` (see Phase 1a table above)
  - Add 3 columns to `wellness_snapshots`: `energy`, `motivation`, `stress` (nullable INTEGER, CHECK 1-5)
  - Add `UNIQUE(creator_id, DATE(created_at))` partial index on `wellness_snapshots` — TOCTOU-safe pulse frequency guard at DB level
  - Add 3 columns + UNIQUE to `burnout_risk_history`: `week` TEXT, `score` INTEGER (CHECK 0-100), `level` TEXT (CHECK enum), `UNIQUE(creator_id, week)`
  - Backfill: `UPDATE burnout_risk_history SET score = ROUND(risk_score), level = risk_level WHERE score IS NULL AND risk_score IS NOT NULL`
  - Use plain `ALTER TABLE ADD COLUMN IF NOT EXISTS` (not DO $$ blocks). Only UNIQUE constraints need procedural guard
  - Index: `CREATE INDEX IF NOT EXISTS idx_burnout_risk_creator_week ON burnout_risk_history(creator_id, week)`
  - Index: `CREATE INDEX IF NOT EXISTS idx_wellness_snapshots_creator_id ON wellness_snapshots(creator_id)`
  - **Verify**: Run `supabase db reset` twice — confirm idempotent, zero errors. Verify columns exist. Verify UNIQUE constraint rejects duplicate `(creator_id, week)` inserts
- **Blocked by**: nothing
- **Blocks**: T2, T3, T4
- **Note**: Phase 1d (`wellness_benchmarks` columns) CUT — no Slice 7 code reads those columns. Defer to a slice that needs benchmark data.

---

### Phase 2: Backend Implementation (parallel within phase, after T1)

---

**T2: Fix dnd_active write path + add pulse frequency guard**

- **Expert**: `backend`
- **Files**: `packages/backend/src/services/wellness/BoundaryService.ts`, `packages/backend/src/services/wellness/WellnessService.ts`
- **DoD items**: Boundaries persist, Pulse data integrity
- **Spec**:
  - **dnd_active bug fix**: In `updateBoundaries()` at line 85-88, add `payload.dnd_active = input.dnd_mode.active` to the `if (input.dnd_mode)` block. 1-line fix — DND toggle currently never persists to DB
  - **Pulse frequency guard**: Add `checkPulseEligibility(creatorId: string): Promise<boolean>` method to `WellnessService` (NOT in route handler — service-layer abstraction). Query: `db.from('wellness_snapshots').select('*', { count: 'exact', head: true }).eq('creator_id', creatorId).gte('created_at', todayStartUTC)`. Returns false if `count >= 1`
  - In `POST /pulse` route handler: call `wellnessService.checkPulseEligibility(creatorId)` → return `409 CONFLICT` if false
  - DB-level `UNIQUE(creator_id, DATE(created_at))` from T1 is the true guard; the service check is a user-friendly early return
  - **Known limitation**: `new Date().toISOString()` uses UTC — documented, consistent with existing codebase
- **Blocked by**: T1
- **Blocks**: T5

---

**T3: Create BurnoutRefreshProcessor with DI and bootstrap scheduling**

- **Expert**: `backend`
- **Files**:
  - `packages/backend/src/services/wellness/BurnoutRefreshProcessor.ts` (NEW)
  - `packages/backend/src/container/types.ts`
  - `packages/backend/src/container/bindings/phase7.bindings.ts`
  - `packages/backend/src/bootstrap.ts`
- **DoD items**: BullMQ batch job, Burnout score from real data
- **Spec**:
  - Implements `IJobProcessor<BurnoutRefreshJobData>` (follow `CrossPublishProcessor.ts` pattern — but do NOT copy its `@ts-nocheck`)
  - Queue name: `burnout-scoring`, processor name: `burnout-daily-refresh`, concurrency: `1`
  - Constructor: `(burnoutService: IBurnoutScoringService, db: ISupabaseClient, logger: ILogger)`
  - `process()`: Query active creators (`SELECT DISTINCT creator_id FROM creator_work_patterns WHERE date >= NOW() - INTERVAL '30 days'`), paginated (PAGE_SIZE=500). For each creator: `try { await this.burnoutService.calculateScore(creatorId) } catch (err) { this.logger.error(...); failedCount++ }`. Log summary: `{ total, succeeded, failed }`
  - `onFailed()`: Log error with `job.attemptsMade`
  - `onCompleted()`: Log summary for operational visibility (`{ total, succeeded, failed }`)
  - No `// @ts-nocheck`. Full TypeScript strict. No `any`.
  - `BurnoutRefreshJobData`: `{ triggeredBy: 'cron' | 'manual' }`
  - **DI registration** in `phase7.bindings.ts`:
    ```typescript
    registry.registerSingletonFactory(TYPES.BurnoutRefreshProcessor, (container) => {
      const burnoutService = container.resolve(TYPES.BurnoutScoringService);
      const db = container.resolve(TYPES.Database);
      const logger = container.resolve(TYPES.Logger);
      return new BurnoutRefreshProcessor(burnoutService, asDb(db), logger);
    });
    ```
    Note: `asDb()` wrapper is REQUIRED — `TYPES.Database` resolves as `Record<string, unknown>`, not `ISupabaseClient`
  - **Update `types.ts`**: Add `BurnoutRefreshProcessor` to `TYPES` object, `SERVICE_LIFETIMES.singleton`, `SERVICE_DEPENDENCIES` (`['BurnoutScoringService', 'Database', 'Logger']`), and `SERVICE_TAGS.wellness`
  - **Bootstrap scheduling** in `bootstrap.ts` — insert AFTER Phase 3 (container creation, ~line 147), BEFORE health checks:
    ```typescript
    if (process.env.REDIS_URL) {
      queueService.createQueue('burnout-scoring', {
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 500 },
        },
      });
      queueService.registerProcessor(container.resolve(TYPES.BurnoutRefreshProcessor));
      queueService.addJob(
        'burnout-scoring',
        'burnout-daily-refresh',
        { triggeredBy: 'cron' },
        { repeat: { pattern: '0 2 * * *' }, jobId: 'burnout-refresh-daily' }
      );
    }
    ```
    No feature flag — register unconditionally like `CrossPublishProcessor`. Simple `if (!process.env.REDIS_URL) return` guard is sufficient.
- **Blocked by**: T1
- **Blocks**: T6

---

**T4: Improve tax export — annual total + pagination fix**

- **Expert**: `backend`
- **File**: `packages/backend/src/services/finance/TaxService.ts`
- **DoD items**: Tax export improvements
- **Spec**:
  - **Annual total row**: After quarterly summary rows in CSV, append: `Annual,{sum revenue},{sum expenses},{sum net},{sum usdRevenue},{sum usdExpenses},{sum usdNet}`
  - **Remove 100-row export limit**: New private method `getExpensesForExport(creatorId, startDate, endDate)` using paginated accumulation (PAGE_SIZE=500 loop) instead of `getExpenses()` with `.limit(100)`. The UI list endpoint keeps its limit.
  - **JSON export**: Add `annualTotal` object to return value: `{ year, quarters, annualTotal, expenses }`
  - Apply `csvCell()` sanitization to all string columns
  - **Note**: `TaxService.ts` has `// @ts-nocheck` (line 1). This is pre-existing tech debt. New methods should be written as if strict mode were on (proper types, no `any`). Removing `@ts-nocheck` is deferred — it would require fixing all pre-existing type errors in the 409-line file.
- **Blocked by**: T1
- **Blocks**: T7
- **Scope note** (per DHH review): Revenue rows section and rate provenance columns are deferred — not required by DoD. Ship the minimum: annual total + pagination fix.

---

### Phase 3: Tests (parallel within phase, after Phase 2)

---

**T5: Backend tests — wellness (pulse guard + dnd_active fix)**

- **Expert**: `qa-backend`
- **Files**: `packages/backend/src/__tests__/routes/v2/wellness.routes.test.ts` (extend), `packages/backend/src/services/wellness/__tests__/BoundaryService.test.ts` (extend)
- **Spec**:
  - **Pulse guard tests**:
    - Test: `POST /pulse` with existing today's check-in → 409
    - Test: `POST /pulse` with no today's check-in → 200 (delegates to service)
    - Test: `POST /pulse` with yesterday's check-in only → 200 (new day allowed)
    - Mock `wellness_snapshots` count query per test
  - **dnd_active tests**:
    - Test: `updateBoundaries({ dnd_mode: { active: true, ... } })` → verify upsert payload includes `dnd_active: true`
    - Test: `updateBoundaries({ dnd_mode: { active: false, ... } })` → verify `dnd_active: false`
    - Test: `getBoundaries()` when `row.dnd_active = true` → returns `dnd_mode.active: true`
    - Use existing mock pattern from `BoundaryService.test.ts`
- **Blocked by**: T2
- **Blocks**: nothing

---

**T6: Backend tests — BurnoutRefreshProcessor**

- **Expert**: `qa-backend`
- **File**: `packages/backend/src/services/wellness/__tests__/BurnoutRefreshProcessor.test.ts` (NEW)
- **Spec**:
  - Test: metadata — `name === 'burnout-daily-refresh'`, `queueName === 'burnout-scoring'`, `concurrency === 1`
  - Test: `process()` with 3 active creators → calls `calculateScore()` 3 times
  - Test: `process()` with 1 of 3 failing → continues to other 2, logs error, does not throw
  - Test: `process()` with 0 active creators → completes with `{ total: 0, succeeded: 0, failed: 0 }` log
  - Test: `process()` with >500 active creators — fetches multiple pages (pagination test)
  - Test: `onFailed()` → logs error with `job.attemptsMade`
  - Mock `IBurnoutScoringService.calculateScore` (mock at service boundary, not DB level), `ISupabaseClient.from('creator_work_patterns')`, `ILogger`
  - Use `createMockLogger()` + table-aware mock chain (common-solutions #7)
- **Blocked by**: T3
- **Blocks**: nothing

---

**T7: Backend tests — tax export improvements**

- **Expert**: `qa-backend`
- **File**: `packages/backend/src/services/finance/__tests__/TaxService.test.ts` (extend)
- **Spec**:
  - Test: CSV annual total row is present after Q4 and sums correctly
  - Test: JSON export includes `annualTotal` object
  - Test: Expense pagination — mock 2 pages (>500 entries) → all rows included in export
  - Test: CSV injection protection applies to expense fields (formula chars prefixed with `'`)
  - Use existing `makeDb()` factory pattern from TaxService.test.ts
- **Blocked by**: T4
- **Blocks**: nothing

---

**T8: E2E — wellness + business tax export**

- **Expert**: `qa-e2e`
- **Files**: `packages/frontend/e2e/wellness.auth.spec.ts` (extend), `packages/frontend/e2e/business.auth.spec.ts` (extend)
- **Spec**:
  - Update POMs as needed: `wellness.page.ts` (pulseModal, pulseSubmitButton, dndToggle, focusHoursToggle, saveButton), `business.page.ts` (exportCsvButton, yearSelector)
  - **Boundary persistence**: Navigate to wellness → find boundary settings → toggle a setting (e.g., notification batching) → click Save → reload page → verify the setting persisted
  - **Burnout gauge renders**: Navigate to wellness → verify either burnout gauge with score OR "building baseline" message is visible (one or the other, never blank)
  - **Schedule recommendations visible**: Verify recommended posts/week or "Start posting" message is rendered
  - **Pulse check-in**: Click Pulse Check-In button → verify modal opens → adjust sliders → click Submit → verify modal closes (or success feedback visible)
  - **Tax export trigger**: Navigate to business → tax tab → click Export CSV button → verify download triggers (button enabled + no error state after click)
  - **Tax year selector**: Change year dropdown → verify summary section re-renders
  - Use `.first()` on any locator matching multiple elements. Role-based locators only. Zero `page.route()` mocks
- **Blocked by**: T1 (schema must exist for API to work)
- **Blocks**: nothing

---

### Parallel Work Diagram

```
T1 (migration SQL)
  │
  ▼ Phase 2 (all parallel after T1)
  ┌─────────────┬──────────────┬──────────┐
  ▼             ▼              ▼          ▼
T2 (dnd +     T3 (processor   T4 (tax)  T8 (E2E)
 pulse guard)  + DI + boot)     │
  │             │              ▼
  ▼             ▼            T7 (tax test)
T5 (wellness  T6 (processor
 tests)        test)
```

**Parallel lanes** (3 experts):

- Lane A: `backend` → T1 → T2 + T3 + T4 (parallel after T1)
- Lane B: `qa-backend` → T5 + T6 + T7 (after respective impl todos)
- Lane C: `qa-e2e` → T8 (after T1 — schema is all they need)

## Critical Patterns to Follow

| Pattern                                                   | Ref                      | Where Applied                                                |
| --------------------------------------------------------- | ------------------------ | ------------------------------------------------------------ |
| Paginated accumulation (PAGE_SIZE=500)                    | Critical #3              | Tax export expenses, processor active creators query         |
| Service-layer abstraction                                 | Critical #2              | Pulse guard in WellnessService, NOT route handler            |
| DB + Queue compensation                                   | Critical #4c             | BurnoutRefreshProcessor per-creator error isolation          |
| DI singleton registration + `asDb()`                      | phase7.bindings.ts       | BurnoutRefreshProcessor registration                         |
| `SERVICE_DEPENDENCIES`/`SERVICE_LIFETIMES`/`SERVICE_TAGS` | types.ts                 | Must update all 3 for new processor                          |
| IJobProcessor pattern                                     | CrossPublishProcessor.ts | BurnoutRefreshProcessor structure (but no @ts-nocheck)       |
| CSV injection protection                                  | TaxService L-5           | Tax export string columns                                    |
| `ALTER TABLE ADD COLUMN IF NOT EXISTS`                    | Migration standard       | All DDL — no DO $$ blocks needed                             |
| TOCTOU prevention via DB constraint                       | Critical #1              | `UNIQUE(creator_id, DATE(created_at))` on wellness_snapshots |

## References

- Roadmap: `/Users/fp/Desktop/story-map-v2-production-roadmap.md` (Slice 7)
- BullMQ ADR brainstorm: `docs/brainstorms/2026-02-26-adr-019-020-bullmq-rest-zod-brainstorm.md`
- Canonical processor example: `packages/backend/src/services/distribution/CrossPublishProcessor.ts`
- Phase 7 compound doc: `docs/solutions/feature-implementation/phase7-creator-safety-net-sprint.md`
- Business Manager learnings: `docs/solutions/feature-implementation/business-manager-institutional-learnings-20260304.md`
- Critical patterns: `docs/solutions/patterns/critical-patterns.md`
- Existing services: `packages/backend/src/services/wellness/` (4 files)
- Existing routes: `packages/backend/src/routes/v2/wellness.routes.ts`
- Existing hooks: `packages/frontend/src/features/wellness/hooks/`
- Existing components: `packages/frontend/src/features/wellness/components/`
