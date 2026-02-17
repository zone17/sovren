# Phase 1 Epics Architecture Plan

**Epics**: EPIC-007 (Creator Wellness), EPIC-008 (Content Shield), EPIC-009 (Multi-Platform Hub)
**Date**: 2026-02-16 (updated 2026-02-17 with PO review feedback)
**Status**: Architecture Complete (PO Validated)
**Dependencies**: All infrastructure prerequisites complete (BullMQ, nostr-tools 2.23.0, ADRs 019-022)

---

## 1. System Architecture Overview

### 1.1 High-Level Architecture

```
                           ┌──────────────────────────────────────────┐
                           │            Frontend (React 18)            │
                           │                                          │
                           │  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
                           │  │ Wellness │ │ Content  │ │  Multi-  │ │
                           │  │Dashboard │ │  Shield  │ │ Platform │ │
                           │  └────┬─────┘ └────┬─────┘ └────┬─────┘ │
                           └───────┼─────────────┼────────────┼───────┘
                                   │             │            │
                               /api/v2       /api/v2      /api/v2
                           ┌───────┼─────────────┼────────────┼───────┐
                           │       ▼             ▼            ▼       │
                           │  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
                           │  │ Wellness │ │  Shield  │ │ Distrib  │ │
                           │  │  Routes  │ │  Routes  │ │  Routes  │ │
                           │  └────┬─────┘ └────┬─────┘ └────┬─────┘ │
                           │       │             │            │       │
                           │       ▼             ▼            ▼       │
                           │  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
                           │  │Wellness  │ │Provenance│ │Distribu- │ │
                           │  │Services  │ │Services  │ │tion Svcs │ │
                           │  │(4 svcs)  │ │(4 svcs)  │ │(4 svcs)  │ │
                           │  └────┬─────┘ └────┬─────┘ └────┬─────┘ │
                           │       │             │            │       │
                           │       ▼             ▼            ▼       │
                           │  ┌──────────────────────────────────────┐│
                           │  │     Supabase (PostgreSQL + RLS)      ││
                           │  │  + Redis (BullMQ Queues + Cache)     ││
                           │  └──────────────────────────────────────┘│
                           │            Backend (Express)              │
                           └───────────────────────────────────────────┘
                                              │
                                  ┌───────────┼───────────┐
                                  ▼           ▼           ▼
                            ┌──────────┐ ┌──────────┐ ┌──────────┐
                            │  NOSTR   │ │ External │ │  BullMQ  │
                            │  Relays  │ │  OAuth   │ │  Workers │
                            └──────────┘ │Providers │ └──────────┘
                                         └──────────┘
```

### 1.2 Service Registry (Existing + New)

**Existing services** (already registered in `packages/backend/src/container/types.ts`):

| Service | DI Token | Epic | Status |
|---------|----------|------|--------|
| WellnessService | `TYPES.WellnessService` | 007 | Implemented |
| BurnoutScoringService | `TYPES.BurnoutScoringService` | 007 | Implemented |
| ScheduleService | `TYPES.ScheduleService` | 007 | Implemented |
| BoundaryService | `TYPES.BoundaryService` | 007 | Implemented |
| ProvenanceService | `TYPES.ProvenanceService` | 008 | Implemented |
| FingerprintService | `TYPES.FingerprintService` | 008 | Implemented |
| AlertService | `TYPES.AlertService` | 008 | Implemented |
| DmcaService | `TYPES.DmcaService` | 008 | Implemented |
| QueueService | `TYPES.QueueService` | Infra | Implemented |

**New services required** (EPIC-009 only):

| Service | DI Token (to add) | Purpose |
|---------|-------------------|---------|
| PlatformConnectionService | `TYPES.PlatformConnectionService` | OAuth flows, token management |
| CrossPostService | `TYPES.CrossPostService` | Publishing queue, platform adapters |
| RepurposingService | `TYPES.RepurposingService` | Content format conversion |
| UnifiedInboxService | `TYPES.UnifiedInboxService` | Multi-platform message aggregation |
| CrossPlatformAnalyticsService | `TYPES.CrossPlatformAnalyticsService` | Aggregate metrics |

### 1.3 BullMQ Queue Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     BullMQ Queue Map                          │
│                                                              │
│  ┌─────────────────┐   ┌──────────────────┐                 │
│  │  relay-scan      │   │  cross-publish    │                 │
│  │  (EPIC-008)      │   │  (EPIC-009)       │                 │
│  │                  │   │                   │                 │
│  │  Concurrency: 3  │   │  Concurrency: 5   │                 │
│  │  Retries: 5      │   │  Retries: 3       │                 │
│  │  Backoff: exp     │   │  Backoff: exp      │                 │
│  │  2s/8s/32s       │   │  5s/20s/60s        │                 │
│  └─────────────────┘   └──────────────────┘                 │
│                                                              │
│  ┌──────────────────┐   ┌──────────────────┐                 │
│  │  content-fp       │   │  inbox-poll       │                 │
│  │  (EPIC-008)       │   │  (EPIC-009)       │                 │
│  │                   │   │                   │                 │
│  │  Concurrency: 3   │   │  Concurrency: 3   │                 │
│  │  Retries: 3       │   │  Retries: 3       │                 │
│  │  Backoff: exp      │   │  Backoff: fixed    │                 │
│  │  5s/20s/80s        │   │  30s               │                 │
│  └──────────────────┘   └──────────────────┘                 │
│                                                              │
│  ┌──────────────────┐                                        │
│  │  token-refresh    │                                        │
│  │  (EPIC-009)       │                                        │
│  │                   │                                        │
│  │  Concurrency: 2   │                                        │
│  │  Retries: 3       │                                        │
│  │  Cron: */15 * * * │                                        │
│  └──────────────────┘                                        │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. EPIC-007: Creator Wellness System

### 2.1 Architecture Status

EPIC-007 services, routes, types, and frontend components are **already implemented** in the infrastructure sprint. The architecture below documents what exists for implementation agent reference.

### 2.2 API Contract

All endpoints use the prefix `/api/v2/wellness`. Authentication required (NOSTR pubkey via middleware).

#### Work Patterns

| Method | Path | Validators | Response | Story |
|--------|------|-----------|----------|-------|
| `POST` | `/patterns` | `WellnessValidators.recordWorkPattern` | `201 { success, data: WorkPattern }` | US-E7-002 |
| `GET` | `/patterns?period=7d\|30d\|90d` | `WellnessValidators.getWorkPatterns` | `200 { success, data: WorkPatternAggregation }` | US-E7-002 |
| `GET` | `/patterns/heatmap?period=7d\|30d` | `WellnessValidators.getHeatmap` | `200 { success, data: HeatmapData }` | US-E7-002 |

**Zod Schemas** (in `packages/backend/src/validators/wellness.ts`):

```typescript
// recordWorkPattern
z.object({
  type: z.enum(['content_creation', 'engagement', 'management']),
  duration_mins: z.number().int().min(1).max(1440),
  timestamp: z.string().datetime(),
  metadata: z.record(z.string()).optional(),
})

// getWorkPatterns
z.object({ period: z.enum(['7d', '30d', '90d']) })

// getHeatmap
z.object({ period: z.enum(['7d', '30d']) })
```

#### Burnout Risk Score

| Method | Path | Validators | Response | Story |
|--------|------|-----------|----------|-------|
| `GET` | `/risk-score` | None | `200 { success, data: BurnoutRiskScore }` | US-E7-003 |
| `PUT` | `/risk-score/sensitivity` | `WellnessValidators.setSensitivity` | `200 { success, data: { sensitivity, updated_at } }` | US-E7-003 |

```typescript
// setSensitivity
z.object({ sensitivity: z.enum(['relaxed', 'normal', 'sensitive']) })
```

#### Sustainable Scheduling

| Method | Path | Response | Story |
|--------|------|----------|-------|
| `GET` | `/schedule/recommendations` | `200 { success, data: ScheduleRecommendation }` | US-E7-005 |
| `GET` | `/buffer-depth` | `200 { success, data: BufferDepth }` | US-E7-005 |

#### Creator Boundaries

| Method | Path | Validators | Response | Story |
|--------|------|-----------|----------|-------|
| `GET` | `/boundaries` | None | `200 { success, data: CreatorBoundaries }` | US-E7-006 |
| `PUT` | `/boundaries` | `WellnessValidators.updateBoundaries` | `200 { success, data: CreatorBoundaries }` | US-E7-006 |

```typescript
// updateBoundaries
z.object({
  focus_hours: z.object({
    enabled: z.boolean(),
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/),
    timezone: z.string(),
    days: z.array(z.enum(['monday','tuesday','wednesday','thursday','friday','saturday','sunday'])),
  }).optional(),
  weekly_engagement_budget_mins: z.number().int().min(0).max(10080).optional(),
  dnd_mode: z.object({
    active: z.boolean(),
    auto_response_enabled: z.boolean(),
    auto_response_template: z.string().max(500),
  }).optional(),
  availability_status: z.enum(['hidden','available','creating','offline']).optional(),
  availability_public: z.boolean().optional(),
  notification_batching: z.boolean().optional(),
})
```

#### Wellness Pulse Check-Ins

| Method | Path | Validators | Response | Story |
|--------|------|-----------|----------|-------|
| `POST` | `/pulse` | `WellnessValidators.recordPulse` | `201 { success, data: PulseCheckIn }` | US-E7-007 |
| `GET` | `/pulse/history?period=30d\|90d\|all&limit=50&offset=0` | `WellnessValidators.getPulseHistory` | `200 { success, data: PulseHistory }` | US-E7-007 |
| `GET` | `/benchmark` | None (optional auth) | `200 { success, data: WellnessBenchmark \| null }` | US-E7-007 |
| `DELETE` | `/pulse` | None | `200 { success, data: { deleted_count } }` | US-E7-007 |
| `DELETE` | `/data` | None | `200 { success, data: { deleted } }` | GDPR |

```typescript
// recordPulse
z.object({
  energy: z.number().int().min(1).max(5),
  motivation: z.number().int().min(1).max(5),
  stress: z.number().int().min(1).max(5),
})

// getPulseHistory
z.object({
  period: z.enum(['30d', '90d', 'all']),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})
```

#### Error Responses (All EPIC-007 Endpoints)

```typescript
// 400 Bad Request
{ success: false, error: 'VALIDATION_ERROR', message: string, timestamp: string }

// 401 Unauthorized
{ success: false, error: 'UNAUTHORIZED', message: 'Authentication required', timestamp: string }

// 403 Forbidden
{ success: false, error: 'FORBIDDEN', message: string, timestamp: string }

// 429 Too Many Requests
{ success: false, error: 'RATE_LIMITED', message: string, timestamp: string }

// 500 Internal Server Error
{ success: false, error: 'INTERNAL_ERROR', message: string, timestamp: string }
```

### 2.3 Database Schema

#### Table: `wellness_snapshots` (Pulse Check-Ins)

```sql
CREATE TABLE wellness_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id TEXT NOT NULL,
  energy SMALLINT NOT NULL CHECK (energy BETWEEN 1 AND 5),
  motivation SMALLINT NOT NULL CHECK (motivation BETWEEN 1 AND 5),
  stress SMALLINT NOT NULL CHECK (stress BETWEEN 1 AND 5),
  composite_score NUMERIC(4,2) GENERATED ALWAYS AS (
    ROUND(((energy + motivation + (6 - stress))::NUMERIC / 3), 2)
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_wellness_snapshots_creator ON wellness_snapshots(creator_id);
CREATE INDEX idx_wellness_snapshots_creator_created ON wellness_snapshots(creator_id, created_at DESC);

-- RLS
ALTER TABLE wellness_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Creators can only access own wellness data"
  ON wellness_snapshots FOR ALL
  USING (creator_id = auth.uid()::TEXT);
```

#### Table: `creator_work_patterns` (Daily Activity)

```sql
CREATE TABLE creator_work_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id TEXT NOT NULL,
  date DATE NOT NULL,
  content_time_mins INTEGER NOT NULL DEFAULT 0,
  engagement_time_mins INTEGER NOT NULL DEFAULT 0,
  management_time_mins INTEGER NOT NULL DEFAULT 0,
  total_hours NUMERIC(5,2) GENERATED ALWAYS AS (
    ROUND(((content_time_mins + engagement_time_mins + management_time_mins)::NUMERIC / 60), 2)
  ) STORED,
  post_count INTEGER NOT NULL DEFAULT 0,
  first_activity_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(creator_id, date)
);

-- Indexes
CREATE INDEX idx_work_patterns_creator ON creator_work_patterns(creator_id);
CREATE INDEX idx_work_patterns_creator_date ON creator_work_patterns(creator_id, date DESC);

-- RLS
ALTER TABLE creator_work_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Creators can only access own work patterns"
  ON creator_work_patterns FOR ALL
  USING (creator_id = auth.uid()::TEXT);
```

#### Table: `creator_boundaries`

```sql
CREATE TABLE creator_boundaries (
  creator_id TEXT PRIMARY KEY,
  focus_hours JSONB NOT NULL DEFAULT '{"enabled":false,"start":"09:00","end":"17:00","timezone":"UTC","days":[]}',
  weekly_engagement_budget_mins INTEGER DEFAULT 0,
  engagement_used_mins INTEGER DEFAULT 0,
  dnd_mode JSONB NOT NULL DEFAULT '{"active":false,"auto_response_enabled":false,"auto_response_template":""}',
  availability_status TEXT NOT NULL DEFAULT 'available' CHECK (availability_status IN ('hidden','available','creating','offline')),
  availability_public BOOLEAN NOT NULL DEFAULT false,
  notification_batching BOOLEAN NOT NULL DEFAULT false,
  sensitivity_level TEXT NOT NULL DEFAULT 'normal' CHECK (sensitivity_level IN ('relaxed','normal','sensitive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE creator_boundaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Creators can only access own boundaries"
  ON creator_boundaries FOR ALL
  USING (creator_id = auth.uid()::TEXT);
```

#### Table: `burnout_risk_history`

```sql
CREATE TABLE burnout_risk_history (
  creator_id TEXT NOT NULL,
  week TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  level TEXT NOT NULL CHECK (level IN ('low','moderate','high','critical')),
  factors JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(creator_id, week)
);

-- RLS
ALTER TABLE burnout_risk_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Creators can only access own burnout history"
  ON burnout_risk_history FOR ALL
  USING (creator_id = auth.uid()::TEXT);
```

#### Materialized View: `wellness_benchmarks`

```sql
CREATE MATERIALIZED VIEW wellness_benchmarks AS
SELECT
  COUNT(DISTINCT creator_id) AS sample_size,
  AVG(avg_weekly_hours) AS avg_weekly_hours,
  PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY avg_weekly_hours) AS p25_hours,
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY avg_weekly_hours) AS p50_hours,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY avg_weekly_hours) AS p75_hours
FROM (
  SELECT creator_id, AVG(total_hours * 7) AS avg_weekly_hours
  FROM creator_work_patterns
  WHERE date >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY creator_id
  HAVING COUNT(*) >= 7
) sub;
```

### 2.4 Frontend Component Tree

```
packages/frontend/src/features/wellness/
├── components/
│   ├── WellnessDashboard.tsx          ← Main dashboard view (tabs container)
│   ├── WorkPatternHeatmap.tsx         ← Hourly activity heatmap grid
│   ├── BurnoutRiskGauge.tsx           ← Visual gauge (green → red)
│   ├── RestDayTracker.tsx             ← Streak counter + work/rest ratio
│   ├── SustainableScheduler.tsx       ← Cadence recommendations + buffer
│   ├── BoundarySettings.tsx           ← Focus hours, DND, engagement budget
│   ├── WellnessPulseModal.tsx         ← Weekly pulse check-in prompt
│   ├── WellnessTrend.tsx              ← Line chart of pulse composite score
│   ├── WellnessResources.tsx          ← Static curated resource cards
│   └── __tests__/                     ← Component tests
├── hooks/
│   ├── useWellnessPatterns.ts         ← React Query: GET /patterns
│   ├── useBurnoutScore.ts            ← React Query: GET /risk-score
│   ├── useSchedule.ts                ← React Query: GET /schedule/*
│   ├── useBoundaries.ts              ← React Query: GET/PUT /boundaries
│   └── usePulse.ts                   ← React Query: POST/GET /pulse
├── services/
│   └── wellnessApi.ts                ← Axios/fetch client for wellness endpoints
├── types/
│   └── index.ts                      ← Re-exports from @sovren/shared/types/wellness
├── ErrorBoundary.tsx
└── index.ts                           ← Barrel exports
```

**Data Flow**:
```
WellnessDashboard
├── Tab: Overview
│   ├── BurnoutRiskGauge ← useBurnoutScore() → GET /risk-score
│   ├── RestDayTracker ← useWellnessPatterns('7d') → GET /patterns?period=7d
│   └── WellnessTrend ← usePulse() → GET /pulse/history
├── Tab: Activity
│   └── WorkPatternHeatmap ← useWellnessPatterns() → GET /patterns/heatmap
├── Tab: Schedule
│   └── SustainableScheduler ← useSchedule() → GET /schedule/recommendations + /buffer-depth
├── Tab: Boundaries
│   └── BoundarySettings ← useBoundaries() → GET/PUT /boundaries
└── Tab: Resources
    └── WellnessResources (static data, no API call)
```

---

## 3. EPIC-008: Content Shield (AI Protection)

### 3.1 Architecture Status

EPIC-008 services, routes, types, and frontend components are **already implemented** in the infrastructure sprint. The architecture below documents what exists plus gaps to fill.

### 3.2 API Contract

All endpoints use the prefix `/api/v2/shield`. Mixed authentication (some public, some creator-only).

#### Provenance

| Method | Path | Auth | Validators | Response | Story |
|--------|------|------|-----------|----------|-------|
| `GET` | `/provenance/:contentId` | Optional | `ShieldValidators.contentIdParam` | `200 { success, data: ProvenanceRecord }` | US-E8-002 |
| `GET` | `/provenance/:contentId/certificate` | Required | `contentIdParam + certificateQuery` | `200 { success, data: { certificate: ProvenanceCertificate } }` | US-E8-002 |

#### Fingerprinting

| Method | Path | Auth | Validators | Response | Story |
|--------|------|------|-----------|----------|-------|
| `POST` | `/fingerprint` | Required | `ShieldValidators.createFingerprint` | `201 { success, data: Fingerprint }` | US-E8-003 |
| `GET` | `/fingerprints/:creatorId` | Required | `getFingerprintsParam + getFingerprintsQuery` | `200 { success, data, pagination }` | US-E8-003 |
| `POST` | `/compare` | Required | `ShieldValidators.compare` | `200 { success, data: CompareResult }` | US-E8-003 |

**Zod Schemas** (in `packages/backend/src/validators/shield.ts`):

```typescript
// contentIdParam
z.object({ contentId: z.string().uuid() })

// createFingerprint
z.object({
  content_id: z.string().uuid(),
  content_type: z.enum(['text', 'image']),
  content: z.string().min(1).max(100000), // raw text or base64 image
})

// compare
z.object({
  hash_type: z.enum(['simhash', 'phash']),
  hash_value: z.string().regex(/^[0-9a-f]{16}$/), // 64-bit hex
})

// getFingerprintsQuery
z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})
```

#### Alerts

| Method | Path | Auth | Validators | Response | Story |
|--------|------|------|-----------|----------|-------|
| `GET` | `/alerts?status=new\|reviewed\|resolved&page=1&limit=20` | Required | `ShieldValidators.getAlertsQuery` | `200 { success, data: ContentAlert[], pagination }` | US-E8-004b |
| `GET` | `/alerts/:id` | Required | `ShieldValidators.alertIdParam` | `200 { success, data: AlertDetail }` | US-E8-004b |
| `PUT` | `/alerts/:id` | Required | `alertIdParam + updateAlertStatus` | `200 { success, data: ContentAlert }` | US-E8-004b |

```typescript
// getAlertsQuery
z.object({
  status: z.enum(['new','reviewed','resolved','false_positive','reported']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

// updateAlertStatus
z.object({
  status: z.enum(['reviewed','resolved','false_positive','reported']),
})
```

#### DMCA Reports

| Method | Path | Auth | Validators | Response | Story |
|--------|------|------|-----------|----------|-------|
| `POST` | `/alerts/:id/dmca-report` | Required | `alertIdParam + dmcaReportQuery` | `201 { success, data: { report: DmcaReport } }` | US-E8-004c |

### 3.3 Database Schema

#### Table: `provenance_records`

```sql
CREATE TABLE provenance_records (
  content_id UUID PRIMARY KEY,
  creator_id TEXT NOT NULL,
  signature TEXT NOT NULL,
  nostr_event_id TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  relay_confirmations JSONB NOT NULL DEFAULT '[]',
  verification_status TEXT NOT NULL DEFAULT 'verified'
    CHECK (verification_status IN ('verified','unverified','disputed')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_provenance_creator ON provenance_records(creator_id);
CREATE INDEX idx_provenance_nostr_event ON provenance_records(nostr_event_id);

-- RLS: anyone can read provenance (public verification), only creator can insert
ALTER TABLE provenance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read provenance records"
  ON provenance_records FOR SELECT USING (true);
CREATE POLICY "Creators can insert own provenance"
  ON provenance_records FOR INSERT
  WITH CHECK (creator_id = auth.uid()::TEXT);
-- Updates restricted to status column only via trigger (see immutability trigger)

-- Immutability trigger: only status column can be updated (for revocation)
CREATE OR REPLACE FUNCTION enforce_provenance_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.signature != OLD.signature OR NEW.content_hash != OLD.content_hash
     OR NEW.nostr_event_id != OLD.nostr_event_id OR NEW.creator_id != OLD.creator_id THEN
    RAISE EXCEPTION 'Provenance records are immutable. Only status can be updated.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_provenance_immutability
  BEFORE UPDATE ON provenance_records
  FOR EACH ROW EXECUTE FUNCTION enforce_provenance_immutability();
```

#### Table: `content_fingerprints`

```sql
CREATE TABLE content_fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL,
  creator_id TEXT NOT NULL,
  hash_type TEXT NOT NULL CHECK (hash_type IN ('simhash','phash')),
  hash_value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(content_id, hash_type)
);

-- Indexes
CREATE INDEX idx_fingerprints_creator ON content_fingerprints(creator_id);
CREATE INDEX idx_fingerprints_hash ON content_fingerprints(hash_type, hash_value);
CREATE INDEX idx_fingerprints_content ON content_fingerprints(content_id);

-- RLS
ALTER TABLE content_fingerprints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Creators can only access own fingerprints"
  ON content_fingerprints FOR ALL
  USING (creator_id = auth.uid()::TEXT);
```

#### Table: `content_alerts`

```sql
CREATE TABLE content_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id TEXT NOT NULL,
  original_content_id UUID NOT NULL,
  detected_copy_url TEXT NOT NULL,
  detected_author_pubkey TEXT,
  similarity_score NUMERIC(5,4) NOT NULL CHECK (similarity_score BETWEEN 0 AND 1),
  match_level TEXT NOT NULL CHECK (match_level IN ('exact_copy','derivative','coincidental')),
  hash_type TEXT NOT NULL CHECK (hash_type IN ('simhash','phash')),
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','reviewed','resolved','false_positive','reported')),
  relay TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_alerts_creator ON content_alerts(creator_id);
CREATE INDEX idx_alerts_creator_status ON content_alerts(creator_id, status);
CREATE INDEX idx_alerts_detected ON content_alerts(detected_at DESC);

-- RLS
ALTER TABLE content_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Creators can only access own alerts"
  ON content_alerts FOR ALL
  USING (creator_id = auth.uid()::TEXT);
```

### 3.4 BullMQ Scanner Architecture

```
                ┌──────────────────────────────┐
                │     Cron Scheduler           │
                │  (every 15 min per creator)   │
                └──────────────┬───────────────┘
                               │
                    addJob('relay-scan', { creatorId, relays })
                               │
                               ▼
                ┌──────────────────────────────┐
                │  Queue: 'relay-scan'          │
                │  Concurrency: 3               │
                │  Retries: 5, Exp backoff      │
                └──────────────┬───────────────┘
                               │
                               ▼
                ┌──────────────────────────────┐
                │  ScannerWorker.process()      │
                │                              │
                │  1. Connect to relay          │
                │  2. Subscribe to text/image   │
                │     events (Kind 1, Kind 6)   │
                │  3. For each event:           │
                │     a. Compute fingerprint    │
                │     b. Compare against        │
                │        creator's registry     │
                │     c. If match > threshold:  │
                │        INSERT content_alert   │
                │  4. Rate limit: 10 req/min    │
                │     per relay                 │
                │  5. Disconnect after window   │
                └──────────────────────────────┘
```

**Job Data Schema**:
```typescript
interface RelayScanJobData {
  creatorId: string;
  relays: string[];          // Array of relay URLs
  since: number;             // Unix timestamp: scan events after this
  fingerprintIds: string[];  // Creator's fingerprint IDs to compare against
}
```

### 3.5 Provenance Signing Flow (Auto-Sign Integration)

```
Creator publishes content
        │
        ▼
POST /api/v1/content/publish
        │
        ├──→ Existing publish pipeline (save to DB, push to NOSTR)
        │
        ├──→ [NEW HOOK] ProvenanceService.signContent()
        │       │
        │       ├── Compute SHA-256 hash of content body
        │       ├── Sign hash with creator's NOSTR private key (client-side)
        │       ├── Embed provenance tags in NOSTR event:
        │       │   ["provenance", "sha256:<hash>"]
        │       │   ["provenance-sig", "<signature>"]
        │       │   ["provenance-relay", "<relay1>", "<relay2>"]
        │       └── INSERT provenance_records
        │
        └──→ [NEW HOOK] FingerprintService.createFingerprint()
                │
                ├── Text: Compute SimHash (64-bit)
                ├── Images: Compute pHash (64-bit) per attachment
                └── INSERT content_fingerprints
```

### 3.6 Frontend Component Tree

```
packages/frontend/src/features/content-shield/
├── components/
│   ├── ShieldDashboard.tsx            ← Main dashboard view
│   ├── AuthenticityBadge.tsx          ← Inline badge (verified/unverified/disputed)
│   ├── ProvenanceChainViewer.tsx      ← Expandable provenance proof viewer
│   ├── AlertsFeed.tsx                 ← List of detected copies with filters
│   ├── DMCAReportButton.tsx           ← One-click DMCA report generation
│   ├── FingerprintCoverage.tsx        ← Coverage stats (X/Y content fingerprinted)
│   └── __tests__/
├── hooks/
│   ├── useProvenance.ts              ← React Query: GET /provenance/:id
│   ├── useFingerprints.ts            ← React Query: GET /fingerprints/:id
│   ├── useAlerts.ts                  ← React Query: GET /alerts
│   └── useDmca.ts                    ← React Query: POST /alerts/:id/dmca-report
├── services/
│   └── shieldApi.ts                  ← Axios/fetch client for shield endpoints
├── types/
│   └── index.ts                      ← Re-exports from @sovren/shared/types/provenance
├── ErrorBoundary.tsx
└── index.ts                           ← Barrel exports
```

**Data Flow**:
```
ShieldDashboard
├── FingerprintCoverage ← useFingerprints() → GET /fingerprints/:creatorId
├── AlertsFeed ← useAlerts() → GET /alerts
│   ├── AlertDetail (expanded) ← GET /alerts/:id
│   │   └── DMCAReportButton → POST /alerts/:id/dmca-report
│   └── StatusUpdater → PUT /alerts/:id
└── (Inline in content views)
    └── AuthenticityBadge ← useProvenance(contentId) → GET /provenance/:contentId
        └── ProvenanceChainViewer (click-through)
```

---

## 4. EPIC-009: Multi-Platform Hub (NEW)

### 4.1 Architecture Overview

EPIC-009 is an entirely new feature domain. No existing code exists. This section provides the full blueprint.

### 4.2 New DI Service Tokens

Add to `packages/backend/src/container/types.ts`:

```typescript
// Phase 8: Multi-Platform Hub (EPIC-009)
import type { IPlatformConnectionService } from '../interfaces/distribution/IPlatformConnectionService';
import type { ICrossPostService } from '../interfaces/distribution/ICrossPostService';
import type { IRepurposingService } from '../interfaces/distribution/IRepurposingService';
import type { IUnifiedInboxService } from '../interfaces/distribution/IUnifiedInboxService';
import type { ICrossPlatformAnalyticsService } from '../interfaces/distribution/ICrossPlatformAnalyticsService';

// In TYPES object:
PlatformConnectionService: new ServiceToken<IPlatformConnectionService>(
  'PlatformConnectionService',
  'OAuth connections, token encryption, token refresh'
),
CrossPostService: new ServiceToken<ICrossPostService>(
  'CrossPostService',
  'Cross-platform publishing queue via BullMQ'
),
RepurposingService: new ServiceToken<IRepurposingService>(
  'RepurposingService',
  'Content format conversion for different platforms'
),
UnifiedInboxService: new ServiceToken<IUnifiedInboxService>(
  'UnifiedInboxService',
  'Multi-platform message aggregation and routing'
),
CrossPlatformAnalyticsService: new ServiceToken<ICrossPlatformAnalyticsService>(
  'CrossPlatformAnalyticsService',
  'Aggregate cross-platform metrics'
),
```

**Service Dependencies** (add to `SERVICE_DEPENDENCIES`):

```typescript
PlatformConnectionService: ['Database', 'SecretsService', 'QueueService', 'Logger'],
CrossPostService: ['PlatformConnectionService', 'QueueService', 'Logger'],
RepurposingService: ['Database', 'Logger'],
UnifiedInboxService: ['PlatformConnectionService', 'QueueService', 'Database', 'Logger'],
CrossPlatformAnalyticsService: ['PlatformConnectionService', 'Database', 'Logger'],
```

**Service Lifetimes**: All `singleton`.

**Service Tags**: Add `distribution: ['PlatformConnectionService', 'CrossPostService', 'RepurposingService', 'UnifiedInboxService', 'CrossPlatformAnalyticsService']`.

### 4.3 Backend Service Architecture

```
packages/backend/src/
├── services/
│   └── distribution/
│       ├── PlatformConnectionService.ts  # OAuth flows, token encrypt/decrypt/refresh
│       ├── CrossPostService.ts           # Publishing queue, platform formatting
│       ├── RepurposingService.ts         # Long-form → thread, summary, image resize
│       ├── UnifiedInboxService.ts        # Inbox aggregation, reply routing
│       ├── CrossPlatformAnalyticsService.ts # Aggregate metrics
│       └── adapters/
│           ├── IPlatformAdapter.ts       # Platform adapter interface
│           ├── MastodonAdapter.ts        # Mastodon/ActivityPub adapter
│           ├── BlueskyAdapter.ts         # Bluesky/AT Protocol adapter
│           ├── TwitterAdapter.ts         # X/Twitter API v2 adapter
│           └── YouTubeAdapter.ts         # YouTube Data API adapter
├── interfaces/
│   └── distribution/
│       ├── IPlatformConnectionService.ts
│       ├── ICrossPostService.ts
│       ├── IRepurposingService.ts
│       ├── IUnifiedInboxService.ts
│       └── ICrossPlatformAnalyticsService.ts
├── routes/
│   └── v2/
│       ├── platforms.routes.ts           # OAuth connect/disconnect/status
│       ├── distribute.routes.ts          # Cross-post, repurpose, status
│       ├── inbox.routes.ts               # Unified inbox
│       └── analytics-crossplatform.routes.ts # Cross-platform analytics
├── validators/
│   └── distribution.ts                   # Zod schemas for all distribution endpoints
└── workers/
    ├── cross-publish.worker.ts           # BullMQ worker: publish to platforms
    ├── inbox-poll.worker.ts              # BullMQ worker: poll platform messages
    └── token-refresh.worker.ts           # BullMQ worker: refresh expiring tokens
```

### 4.4 Platform Adapter Pattern

```typescript
// packages/backend/src/services/distribution/adapters/IPlatformAdapter.ts

export interface PlatformAdapterConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
}

export interface OAuthTokens {
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  scopes: string[];
}

export interface PublishResult {
  platform_post_id: string;
  url: string;
  published_at: string;
}

export interface PlatformMessage {
  id: string;
  platform: SupportedPlatform;
  author: string;
  content: string;
  type: 'comment' | 'reply' | 'dm' | 'mention';
  parent_post_id: string | null;
  created_at: string;
  is_read: boolean;
}

export interface PlatformMetrics {
  followers: number;
  following: number;
  posts: number;
  engagement_rate: number;
  impressions_30d: number;
}

export interface ContentConstraints {
  max_text_length: number;
  max_images: number;
  max_image_size_bytes: number;
  supported_image_formats: string[];
  supports_threads: boolean;
  supports_video: boolean;
  max_video_length_seconds: number;
}

export interface IPlatformAdapter {
  readonly platform: SupportedPlatform;
  readonly constraints: ContentConstraints;

  // OAuth
  getAuthorizationUrl(state: string): string;
  exchangeCodeForTokens(code: string): Promise<OAuthTokens>;
  refreshTokens(refreshToken: string): Promise<OAuthTokens>;
  revokeTokens(accessToken: string): Promise<void>;

  // Publishing
  publish(tokens: OAuthTokens, content: FormattedContent): Promise<PublishResult>;
  deletePost(tokens: OAuthTokens, platformPostId: string): Promise<void>;

  // Inbox
  getMessages(tokens: OAuthTokens, since: string): Promise<PlatformMessage[]>;
  sendReply(tokens: OAuthTokens, messageId: string, content: string): Promise<void>;

  // Analytics
  getMetrics(tokens: OAuthTokens): Promise<PlatformMetrics>;
  getPostMetrics(tokens: OAuthTokens, postId: string): Promise<PostMetrics>;
}
```

**Platform-specific constraints**:

| Platform | Max Text | Threads | Images | Video |
|----------|---------|---------|--------|-------|
| Mastodon | 500 chars | No | 4 | Yes (60s) |
| Bluesky | 300 chars | Yes (via replies) | 4 | No |
| X/Twitter | 280 chars (free) / 25000 (premium) | Yes | 4 | Yes (140s) |
| YouTube | N/A (description: 5000) | No | 1 (thumbnail) | Yes (unlimited) |

### 4.5 API Contract

#### Platform Connection Routes (`/api/v2/platforms`)

| Method | Path | Auth | Description | Response | Story |
|--------|------|------|-------------|----------|-------|
| `POST` | `/connect/:platform` | Required | Initiate OAuth flow → returns redirect URL | `200 { success, data: { authorization_url } }` | US-E9-002 |
| `GET` | `/callback/:platform` | Public | OAuth callback handler → redirects to frontend | `302 Redirect` | US-E9-002 |
| `DELETE` | `/disconnect/:platform` | Required | Revoke tokens and remove connection | `200 { success, data: { disconnected: true } }` | US-E9-002 |
| `GET` | `/status` | Required | List connected platforms with status | `200 { success, data: PlatformStatus[] }` | US-E9-002 |

**Zod Schemas**:

```typescript
// Platform param
const platformParam = z.object({
  platform: z.enum(['mastodon', 'bluesky', 'twitter', 'youtube']),
});

// Connect body (optional: Mastodon requires instance URL)
const connectBody = z.object({
  instance_url: z.string().url().optional(), // Required for Mastodon
  scopes: z.array(z.string()).optional(),
}).optional();

// Callback query
const callbackQuery = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});
```

**Response Types**:

```typescript
export type SupportedPlatform = 'mastodon' | 'bluesky' | 'twitter' | 'youtube';

export type ConnectionStatus = 'connected' | 'token_expiring' | 'token_expired' | 'error';

export interface PlatformStatus {
  platform: SupportedPlatform;
  connected: boolean;
  status: ConnectionStatus;
  username: string | null;
  connected_at: string | null;
  expires_at: string | null;
  scopes: string[];
}
```

#### Distribution Routes (`/api/v2/distribute`)

| Method | Path | Auth | Description | Response | Story |
|--------|------|------|-------------|----------|-------|
| `POST` | `/publish` | Required | Queue content for cross-platform publishing | `202 { success, data: { job_id, platforms: CrossPostEntry[] } }` | US-E9-003 |
| `GET` | `/status/:contentId` | Required | Cross-post status per platform | `200 { success, data: CrossPostStatus[] }` | US-E9-003 |
| `POST` | `/repurpose` | Required | Generate platform-optimized versions | `200 { success, data: RepurposedContent[] }` | US-E9-004 |
| `GET` | `/repurposed/:contentId` | Required | Preview repurposed versions | `200 { success, data: RepurposedContent[] }` | US-E9-004 |
| `PUT` | `/repurposed/:id/approve` | Required | Approve a repurposed version | `200 { success, data: RepurposedContent }` | US-E9-004 |

**Zod Schemas**:

```typescript
// Publish request
const publishBody = z.object({
  content_id: z.string().uuid(),
  platforms: z.array(z.enum(['mastodon', 'bluesky', 'twitter', 'youtube'])).min(1),
  schedule: z.object({
    mastodon: z.string().datetime().optional(),
    bluesky: z.string().datetime().optional(),
    twitter: z.string().datetime().optional(),
    youtube: z.string().datetime().optional(),
  }).optional(),
  use_repurposed: z.boolean().default(false),
});

// Repurpose request
const repurposeBody = z.object({
  content_id: z.string().uuid(),
  target_platforms: z.array(z.enum(['mastodon', 'bluesky', 'twitter', 'youtube'])).min(1),
});

// Content ID param
const contentIdParam = z.object({ contentId: z.string().uuid() });
```

**Response Types**:

```typescript
export type CrossPostStatus = 'queued' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'cancelled';

export interface CrossPostEntry {
  id: string;
  content_id: string;
  platform: SupportedPlatform;
  status: CrossPostStatus;
  platform_post_id: string | null;
  platform_url: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  error_message: string | null;
}

export type RepurposeFormatType = 'thread' | 'summary' | 'short_post' | 'video_description';

export interface RepurposedContent {
  id: string;
  source_content_id: string;
  platform: SupportedPlatform;
  format_type: RepurposeFormatType;
  text: string;
  character_count: number;
  character_limit: number;
  approved: boolean;
  backlink_url: string;
}
```

#### Unified Inbox Routes (`/api/v2/inbox`)

| Method | Path | Auth | Description | Response | Story |
|--------|------|------|-------------|----------|-------|
| `GET` | `/messages?platform=all&status=unread&page=1&limit=20` | Required | Aggregated inbox | `200 { success, data: InboxMessage[], pagination }` | US-E9-007 |
| `POST` | `/reply/:messageId` | Required | Reply routed to correct platform | `201 { success, data: { sent: true } }` | US-E9-007 |
| `PUT` | `/batch` | Required | Batch actions (mark read, archive) | `200 { success, data: { updated: number } }` | US-E9-007 |

**Zod Schemas**:

```typescript
// Inbox query
const inboxQuery = z.object({
  platform: z.enum(['all', 'mastodon', 'bluesky', 'twitter', 'youtube', 'nostr']).default('all'),
  status: z.enum(['unread', 'all', 'archived']).default('unread'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Reply body
const replyBody = z.object({
  content: z.string().min(1).max(5000),
});

// Batch action
const batchBody = z.object({
  message_ids: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum(['mark_read', 'mark_unread', 'archive']),
});
```

**Response Types**:

```typescript
export interface InboxMessage {
  id: string;
  platform: SupportedPlatform | 'nostr';
  author: string;
  author_avatar_url: string | null;
  content: string;
  type: 'comment' | 'reply' | 'dm' | 'mention';
  parent_post_id: string | null;
  is_read: boolean;
  created_at: string;
}
```

#### Cross-Platform Analytics Routes (`/api/v2/analytics/cross-platform`)

| Method | Path | Auth | Description | Response | Story |
|--------|------|------|-------------|----------|-------|
| `GET` | `/overview` | Required | Aggregate followers/engagement | `200 { success, data: PlatformOverview }` | US-E9-008 |
| `GET` | `/comparison/:contentId` | Required | Same content, different platforms | `200 { success, data: ContentComparison[] }` | US-E9-008 |
| `GET` | `/roi` | Required | Engagement per hour invested per platform | `200 { success, data: PlatformROI[] }` | US-E9-008 |

**Response Types**:

```typescript
export interface PlatformOverview {
  total_followers: number;
  total_engagement_30d: number;
  platforms: Array<{
    platform: SupportedPlatform | 'nostr';
    followers: number;
    engagement_rate: number;
    impressions_30d: number;
    growth_30d: number; // percentage
  }>;
  updated_at: string;
}

export interface ContentComparison {
  platform: SupportedPlatform;
  platform_post_id: string;
  views: number;
  likes: number;
  shares: number;
  comments: number;
  engagement_rate: number;
  published_at: string;
}

export interface PlatformROI {
  platform: SupportedPlatform | 'nostr';
  engagement_per_hour: number;
  total_engagement_30d: number;
  estimated_hours_30d: number;
  rank: number;
}
```

### 4.6 Database Schema

#### Table: `platform_connections`

```sql
CREATE TABLE platform_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('mastodon','bluesky','twitter','youtube')),
  platform_user_id TEXT,
  platform_username TEXT,
  access_token_encrypted BYTEA NOT NULL,
  refresh_token_encrypted BYTEA,
  token_iv BYTEA NOT NULL,           -- AES-256-GCM initialization vector
  token_auth_tag BYTEA NOT NULL,     -- AES-256-GCM authentication tag
  scopes TEXT[] NOT NULL DEFAULT '{}',
  instance_url TEXT,                   -- Mastodon: instance domain
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'connected'
    CHECK (status IN ('connected','token_expiring','token_expired','error','disconnected')),
  last_refreshed_at TIMESTAMPTZ,
  error_message TEXT,
  UNIQUE(creator_id, platform)
);

-- Indexes
CREATE INDEX idx_platform_connections_creator ON platform_connections(creator_id);
CREATE INDEX idx_platform_connections_status ON platform_connections(status);
CREATE INDEX idx_platform_connections_expires ON platform_connections(expires_at)
  WHERE expires_at IS NOT NULL AND status = 'connected';

-- RLS
ALTER TABLE platform_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Creators can only access own connections"
  ON platform_connections FOR ALL
  USING (creator_id = auth.uid()::TEXT);
```

#### AES-256-GCM Token Encryption

```typescript
// packages/backend/src/services/distribution/crypto.ts

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

// Key from SecretsService (AWS Secrets Manager or env var for dev)
// Must be 32 bytes (256 bits)

export function encryptToken(
  plaintext: string,
  key: Buffer
): { encrypted: Buffer; iv: Buffer; authTag: Buffer } {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { encrypted, iv, authTag };
}

export function decryptToken(
  encrypted: Buffer,
  key: Buffer,
  iv: Buffer,
  authTag: Buffer
): string {
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
```

**Key management**: The 256-bit encryption key is sourced from `SecretsService` (existing — resolves from AWS Secrets Manager in production, environment variable in development). Key name: `PLATFORM_TOKEN_ENCRYPTION_KEY`.

#### Table: `cross_posts`

```sql
CREATE TABLE cross_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id TEXT NOT NULL,
  content_id UUID NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('mastodon','bluesky','twitter','youtube')),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','scheduled','publishing','published','failed','cancelled')),
  platform_post_id TEXT,
  platform_url TEXT,
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  error_message TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  metrics_json JSONB DEFAULT '{}',
  bullmq_job_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_cross_posts_creator ON cross_posts(creator_id);
CREATE INDEX idx_cross_posts_content ON cross_posts(content_id);
CREATE INDEX idx_cross_posts_status ON cross_posts(status);
CREATE INDEX idx_cross_posts_scheduled ON cross_posts(scheduled_at)
  WHERE status = 'scheduled' AND scheduled_at IS NOT NULL;

-- RLS
ALTER TABLE cross_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Creators can only access own cross-posts"
  ON cross_posts FOR ALL
  USING (creator_id = auth.uid()::TEXT);
```

#### Table: `repurposed_content`

```sql
CREATE TABLE repurposed_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id TEXT NOT NULL,
  source_content_id UUID NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('mastodon','bluesky','twitter','youtube')),
  format_type TEXT NOT NULL CHECK (format_type IN ('thread','summary','short_post','video_description')),
  text TEXT NOT NULL,
  character_count INTEGER NOT NULL,
  approved BOOLEAN NOT NULL DEFAULT false,
  backlink_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_repurposed_creator ON repurposed_content(creator_id);
CREATE INDEX idx_repurposed_source ON repurposed_content(source_content_id);

-- RLS
ALTER TABLE repurposed_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Creators can only access own repurposed content"
  ON repurposed_content FOR ALL
  USING (creator_id = auth.uid()::TEXT);
```

#### Table: `inbox_messages` (Cached from Platforms)

```sql
CREATE TABLE inbox_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('mastodon','bluesky','twitter','youtube','nostr')),
  platform_message_id TEXT NOT NULL,
  author TEXT NOT NULL,
  author_avatar_url TEXT,
  content TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('comment','reply','dm','mention')),
  parent_post_id TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  platform_created_at TIMESTAMPTZ NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(creator_id, platform, platform_message_id)
);

-- Indexes
CREATE INDEX idx_inbox_creator ON inbox_messages(creator_id);
CREATE INDEX idx_inbox_creator_unread ON inbox_messages(creator_id, is_read)
  WHERE is_read = false AND is_archived = false;
CREATE INDEX idx_inbox_creator_platform ON inbox_messages(creator_id, platform);
CREATE INDEX idx_inbox_fetched ON inbox_messages(fetched_at DESC);

-- RLS
ALTER TABLE inbox_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Creators can only access own inbox"
  ON inbox_messages FOR ALL
  USING (creator_id = auth.uid()::TEXT);
```

#### Table: `platform_metrics_history`

```sql
CREATE TABLE platform_metrics_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('mastodon','bluesky','twitter','youtube','nostr')),
  followers INTEGER NOT NULL DEFAULT 0,
  following INTEGER NOT NULL DEFAULT 0,
  posts INTEGER NOT NULL DEFAULT 0,
  engagement_rate NUMERIC(7,4) NOT NULL DEFAULT 0,
  impressions_30d INTEGER NOT NULL DEFAULT 0,
  recorded_at DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE(creator_id, platform, recorded_at)
);

-- Indexes
CREATE INDEX idx_platform_metrics_creator ON platform_metrics_history(creator_id);
CREATE INDEX idx_platform_metrics_recorded ON platform_metrics_history(recorded_at DESC);

-- RLS
ALTER TABLE platform_metrics_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Creators can only access own metrics"
  ON platform_metrics_history FOR ALL
  USING (creator_id = auth.uid()::TEXT);
```

### 4.7 OAuth Flow Design

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Frontend  │     │ Backend  │     │ Platform │     │ Supabase │
│          │     │          │     │ OAuth    │     │          │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │
     │ 1. Click       │                │                │
     │   "Connect"    │                │                │
     │───────────────>│                │                │
     │                │ 2. Generate    │                │
     │                │   state token  │                │
     │                │   (CSRF)       │                │
     │                │───────────────>│                │
     │                │   Store state  │                │
     │<───────────────│   in session   │                │
     │ 3. Redirect to │                │                │
     │   auth URL     │                │                │
     │───────────────────────────────>│                │
     │                │                │ 4. User        │
     │                │                │   authorizes   │
     │<───────────────────────────────│                │
     │ 5. Callback    │                │                │
     │   with code    │                │                │
     │───────────────>│                │                │
     │                │ 6. Validate    │                │
     │                │   state token  │                │
     │                │ 7. Exchange    │                │
     │                │   code →tokens │                │
     │                │───────────────>│                │
     │                │<───────────────│                │
     │                │ 8. Encrypt     │                │
     │                │   tokens (AES) │                │
     │                │ 9. Store       │                │
     │                │───────────────────────────────>│
     │<───────────────│                │                │
     │ 10. Redirect   │                │                │
     │  to success    │                │                │
     └────────────────┘                └────────────────┘
```

**Security measures**:
1. **CSRF protection**: Random `state` parameter stored server-side, validated on callback
2. **Token encryption**: All tokens encrypted with AES-256-GCM before database storage
3. **No token in logs**: Token values never appear in log output; only encrypted blobs stored
4. **Automatic refresh**: BullMQ cron job checks `expires_at` every 15 minutes, refreshes tokens expiring within 1 hour
5. **Scoped permissions**: Request minimum scopes needed per platform
6. **Revocation on disconnect**: Call platform's revoke endpoint before deleting DB record

### 4.8 Cross-Platform Publishing Queue (BullMQ)

```
Creator clicks "Distribute"
        │
        ▼
POST /api/v2/distribute/publish
  { content_id, platforms: ['mastodon', 'bluesky'], schedule: { bluesky: '2026-02-17T10:00Z' } }
        │
        ▼
CrossPostService.publish()
        │
        ├── For each platform:
        │     ├── INSERT cross_posts (status: 'queued' or 'scheduled')
        │     └── QueueService.addJob('cross-publish', {
        │           crossPostId, platform, contentId, creatorId
        │         }, {
        │           delay: schedule[platform] ? delayMs : 0,
        │           attempts: 3,
        │           backoff: { type: 'exponential', delay: 5000 },
        │         })
        │
        └── Return { job_id, platforms: [{ id, platform, status }] }

BullMQ Worker: 'cross-publish'
        │
        ▼
CrossPublishWorker.process(job)
        │
        ├── 1. Load cross_post record
        ├── 2. Load creator's platform connection
        ├── 3. Decrypt access token (AES-256-GCM)
        ├── 4. Load content (or repurposed version if use_repurposed)
        ├── 5. Format content via PlatformAdapter.constraints
        │       ├── Truncate text to max_text_length
        │       ├── Resize images to platform dimensions
        │       └── Inject backlink to Sovren original
        ├── 6. PlatformAdapter.publish(tokens, formattedContent)
        ├── 7. UPDATE cross_posts SET
        │       status = 'published',
        │       platform_post_id = result.platform_post_id,
        │       platform_url = result.url,
        │       published_at = now()
        └── 8. On failure: UPDATE status = 'failed', error_message, attempt_count++
             └── If attempts exhausted: move to dead letter queue
```

### 4.9 Content Repurposing Engine

Rule-based content adaptation for MVP (no LLM dependency). Per ADR-006 decision.

```typescript
// packages/backend/src/services/distribution/RepurposingService.ts

interface RepurposingStrategy {
  platform: SupportedPlatform;
  format: RepurposeFormatType;
  transform(content: SourceContent): string;
}

// Long-form → Thread (for Twitter/Bluesky)
// 1. Split by paragraphs or H2 headings
// 2. Number each segment: "1/N", "2/N"
// 3. First tweet = hook (first paragraph or title)
// 4. Last tweet = backlink to original
// 5. Each segment truncated to platform char limit

// Long-form → Summary (for Mastodon)
// 1. Extract first paragraph as hook
// 2. Extract all H2 headings as key takeaways
// 3. Append backlink
// 4. Truncate to 500 chars

// Long-form → Short Post (for Bluesky)
// 1. Extract title + first sentence
// 2. Append backlink
// 3. Truncate to 300 chars

// Image Resizing per Platform
// Uses sharp (existing dependency)
const IMAGE_DIMENSIONS: Record<SupportedPlatform, { width: number; height: number }> = {
  mastodon: { width: 1920, height: 1080 },
  bluesky: { width: 2000, height: 2000 },
  twitter: { width: 1600, height: 900 },
  youtube: { width: 1280, height: 720 },
};
```

### 4.10 Frontend Component Tree

```
packages/frontend/src/features/multi-platform/
├── components/
│   ├── PlatformConnector.tsx          ← Connect/disconnect cards per platform
│   ├── PlatformStatusBadge.tsx        ← Status indicator (connected/expiring/error)
│   ├── DistributionPanel.tsx          ← Select platforms, preview formatting
│   ├── CrossPostQueue.tsx             ← Scheduled + completed cross-posts with status
│   ├── RepurposePreview.tsx           ← Side-by-side preview of adapted content
│   ├── UnifiedInbox.tsx               ← Aggregated messages with platform badges
│   ├── InboxFilterBar.tsx             ← Filter by platform, type, read/unread
│   ├── InboxReplyComposer.tsx         ← Reply-in-place with platform routing
│   ├── CrossPlatformDashboard.tsx     ← Aggregate metrics overview
│   ├── PlatformComparison.tsx         ← Side-by-side performance per platform
│   ├── PlatformROI.tsx                ← Engagement/hour ranking
│   └── __tests__/
├── hooks/
│   ├── usePlatformConnections.ts      ← React Query: GET /platforms/status
│   ├── useCrossPost.ts               ← React Query: POST /distribute/publish + GET /status
│   ├── useRepurpose.ts               ← React Query: POST /distribute/repurpose
│   ├── useInbox.ts                    ← React Query: GET /inbox/messages
│   ├── useCrossPlatformAnalytics.ts   ← React Query: GET /analytics/cross-platform/*
│   └── usePlatformConnect.ts          ← Mutation: POST /platforms/connect
├── services/
│   ├── platformsApi.ts                ← API client for platform connection endpoints
│   ├── distributeApi.ts               ← API client for distribution endpoints
│   ├── inboxApi.ts                    ← API client for inbox endpoints
│   └── analyticsApi.ts               ← API client for cross-platform analytics
├── types/
│   └── index.ts                       ← Re-exports from @sovren/shared/types/distribution
├── ErrorBoundary.tsx
└── index.ts                           ← Barrel exports
```

**Data Flow**:
```
Multi-Platform Hub (top-level nav)
├── Tab: Connections
│   └── PlatformConnector × 4 ← usePlatformConnections() → GET /platforms/status
│       └── PlatformStatusBadge (per connection)
│
├── Tab: Distribute
│   ├── DistributionPanel ← useCrossPost() → POST /distribute/publish
│   │   └── RepurposePreview ← useRepurpose() → POST /distribute/repurpose
│   └── CrossPostQueue ← useCrossPost() → GET /distribute/status/:contentId
│
├── Tab: Inbox
│   ├── InboxFilterBar (controls query params)
│   └── UnifiedInbox ← useInbox() → GET /inbox/messages
│       └── InboxReplyComposer → POST /inbox/reply/:messageId
│
└── Tab: Analytics
    ├── CrossPlatformDashboard ← useCrossPlatformAnalytics() → GET /overview
    ├── PlatformComparison ← → GET /comparison/:contentId
    └── PlatformROI ← → GET /roi
```

### 4.11 Shared Types (New File)

Create `packages/shared/src/types/distribution.ts`:

```typescript
// ============================================================================
// Platform Types
// ============================================================================

export type SupportedPlatform = 'mastodon' | 'bluesky' | 'twitter' | 'youtube';
export type AllPlatform = SupportedPlatform | 'nostr';

export type ConnectionStatus = 'connected' | 'token_expiring' | 'token_expired' | 'error' | 'disconnected';

export interface PlatformStatus {
  platform: SupportedPlatform;
  connected: boolean;
  status: ConnectionStatus;
  username: string | null;
  connected_at: string | null;
  expires_at: string | null;
  scopes: string[];
}

// ============================================================================
// Cross-Post Types
// ============================================================================

export type CrossPostStatus = 'queued' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'cancelled';

export interface CrossPostEntry {
  id: string;
  content_id: string;
  platform: SupportedPlatform;
  status: CrossPostStatus;
  platform_post_id: string | null;
  platform_url: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  error_message: string | null;
}

// ============================================================================
// Repurposing Types
// ============================================================================

export type RepurposeFormatType = 'thread' | 'summary' | 'short_post' | 'video_description';

export interface RepurposedContent {
  id: string;
  source_content_id: string;
  platform: SupportedPlatform;
  format_type: RepurposeFormatType;
  text: string;
  character_count: number;
  character_limit: number;
  approved: boolean;
  backlink_url: string;
}

// ============================================================================
// Inbox Types
// ============================================================================

export type InboxMessageType = 'comment' | 'reply' | 'dm' | 'mention';

export interface InboxMessage {
  id: string;
  platform: AllPlatform;
  author: string;
  author_avatar_url: string | null;
  content: string;
  type: InboxMessageType;
  parent_post_id: string | null;
  is_read: boolean;
  created_at: string;
}

// ============================================================================
// Analytics Types
// ============================================================================

export interface PlatformOverview {
  total_followers: number;
  total_engagement_30d: number;
  platforms: PlatformMetricsSummary[];
  updated_at: string;
}

export interface PlatformMetricsSummary {
  platform: AllPlatform;
  followers: number;
  engagement_rate: number;
  impressions_30d: number;
  growth_30d: number;
}

export interface ContentComparison {
  platform: SupportedPlatform;
  platform_post_id: string;
  views: number;
  likes: number;
  shares: number;
  comments: number;
  engagement_rate: number;
  published_at: string;
}

export interface PlatformROI {
  platform: AllPlatform;
  engagement_per_hour: number;
  total_engagement_30d: number;
  estimated_hours_30d: number;
  rank: number;
}

// ============================================================================
// Pagination (reuse from provenance or define here)
// ============================================================================

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
```

---

## 5. Migration Plan

### 5.1 Migration Sequence

All migrations go into `supabase/migrations/` with timestamp prefixes.

| Order | Migration File | Tables/Functions | Epic |
|-------|---------------|------------------|------|
| 1 | `20260216200000_epic009_platform_connections.sql` | `platform_connections` | 009 |
| 2 | `20260216200100_epic009_cross_posts.sql` | `cross_posts` | 009 |
| 3 | `20260216200200_epic009_repurposed_content.sql` | `repurposed_content` | 009 |
| 4 | `20260216200300_epic009_inbox_messages.sql` | `inbox_messages` | 009 |
| 5 | `20260216200400_epic009_platform_metrics_history.sql` | `platform_metrics_history` | 009 |

EPIC-007 and EPIC-008 tables already exist from the infrastructure sprint. No new migrations needed for those epics.

### 5.2 Rollback Strategy

Each migration includes a `DOWN` section:

```sql
-- Down migration: drop table with CASCADE to remove policies and triggers
DROP TABLE IF EXISTS platform_connections CASCADE;
```

---

## 6. Security Considerations

### 6.1 EPIC-007 Security

- **All wellness data is PRIVATE to creator**: Strict RLS policies (`creator_id = auth.uid()`)
- **GDPR right to erasure**: `deleteAllWellnessData()` uses atomic transaction (all-or-nothing)
- **Benchmarking is anonymous**: K-anonymity minimum 10 participants; materialized view only exposes aggregates
- **No wellness data in platform metrics**: Never used for recommendations, ranking, or monetization decisions

### 6.2 EPIC-008 Security

- **Provenance records are immutable**: Database trigger prevents modification of signature, hash, event ID, creator ID. Only `status` can be updated (for revocation).
- **Public verification**: Anyone can verify provenance (RLS allows SELECT for all), but only creators can INSERT their own records
- **Fingerprints are creator-scoped**: RLS ensures creators only see their own fingerprint registry

### 6.3 EPIC-009 Security (Critical)

- **OAuth token encryption**: AES-256-GCM with random IV per token, auth tag for integrity
- **Encryption key rotation**: Key sourced from SecretsService; rotation requires re-encryption of all stored tokens (batch job)
- **OAuth state CSRF protection**: Random state token stored server-side, validated on callback
- **Token refresh automation**: BullMQ cron job prevents token expiration; expired tokens trigger re-auth prompt
- **No token in logs**: PlatformConnectionService explicitly redacts tokens from all log output
- **Scoped OAuth permissions**: Request minimum scopes per platform (read + write posts, not admin)
- **Platform API rate limiting**: Per-platform rate limits in adapters prevent API bans
- **Token revocation on disconnect**: Always call platform revoke API before deleting DB record

---

## 7. Implementation Order

### Phase 1: Foundation (Week 1)

**EPIC-007** (already implemented — verify and fill gaps):
1. Verify all wellness routes functional
2. Fill remaining gaps: auto-tracking middleware, wellness resource library static data
3. Frontend integration testing

**EPIC-008** (already implemented — verify and fill gaps):
1. Verify all shield routes functional
2. Implement ScannerService BullMQ worker (US-E8-004a)
3. Implement auto-signing hook in content publish pipeline (US-E8-007)
4. Frontend integration testing

**EPIC-009** (new — database + services):
1. Run all 5 database migrations
2. Implement DI tokens and interfaces
3. Implement PlatformConnectionService + OAuth adapters (Mastodon + Bluesky first)
4. Implement token encryption/decryption layer

### Phase 2: Core Features (Week 2)

**EPIC-009** continued:
5. Implement CrossPostService + BullMQ cross-publish worker
6. Implement RepurposingService (thread + summary converters)
7. Implement platform routes (`platforms.routes.ts`, `distribute.routes.ts`)
8. Frontend: PlatformConnector, DistributionPanel, CrossPostQueue, RepurposePreview

### Phase 3: Extended Features (Week 3)

**EPIC-009 Wave B**:
9. Implement UnifiedInboxService + BullMQ inbox-poll worker
10. Implement CrossPlatformAnalyticsService
11. Implement inbox + analytics routes
12. Frontend: UnifiedInbox, CrossPlatformDashboard, PlatformROI

### Phase 4: Integration & QA (Week 4)

- E2E testing for all 3 epics
- Security audit (EPIC-009 OAuth + token storage)
- Performance testing (BullMQ queue throughput)
- Documentation and Mermaid diagrams

---

## 8. ADR References

| ADR | Decision | Epics |
|-----|----------|-------|
| ADR-019 | Weighted 5-factor burnout scoring with personal baselines | EPIC-007 |
| ADR-020 | SimHash (text) + pHash (images) for content fingerprinting | EPIC-008 |
| ADR-021 | Custodial design for payment flows | Future (EPIC-010) |
| ADR-022 | BullMQ for job queues (reuse existing Redis) | EPIC-008, EPIC-009 |

**New ADR needed for EPIC-009**:
- **ADR-023: Platform Adapter Abstraction** — Document the adapter interface pattern for adding new platforms
- **ADR-024: OAuth Token Storage Encryption** — Document AES-256-GCM approach with SecretsService key management

---

## 9. Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| OAuth tokens leaked in logs | Critical | Explicit redaction in all log statements; code review gate |
| Platform API breaking changes | High | Adapter pattern isolates changes to single file per platform |
| BullMQ Redis failure loses queued jobs | High | Redis AOF persistence enabled; DLQ for failed jobs |
| Rate limiting by external platforms | Medium | Per-adapter rate limiters with configurable RPM |
| Token refresh race condition | Medium | BullMQ ensures single worker per token-refresh job |
| Mastodon instance heterogeneity | Medium | Instance URL stored per connection; adapter handles API differences |
| Fingerprint false positives | Medium | Configurable similarity threshold per creator; false_positive status |
| Mastodon multi-instance conflict | Medium | Unique constraint updated to include instance_url (see 10.5) |

---

## 10. Addendum: PO Review Gap Fixes (2026-02-17)

Product-owner validated the architecture and identified 4 gaps + 2 observations. All addressed below.

### 10.1 GAP-1 Fix: Auto-Tracking Middleware (EPIC-007, US-E7-002 AC-4)

**Problem**: No specification for how implicit work events (content publish, DM sends, analytics views) are automatically tracked without manual logging.

**Solution**: Add `WorkTrackingMiddleware` as Express middleware that intercepts specific v1/v2 routes and records activity via `WellnessService.recordWorkPattern()`.

**File**: `packages/backend/src/middleware/work-tracking-middleware.ts`

```typescript
import type { Request, Response, NextFunction } from 'express';
import type { IWellnessService, CreateWorkPatternInput } from '../interfaces/wellness/IWellnessService';
import { container } from '../container';
import { TYPES } from '../container/types';

// Route patterns → activity type mapping
const TRACKING_RULES: Array<{
  method: string;
  pathPattern: RegExp;
  activityType: 'content_creation' | 'engagement' | 'management';
  estimatedMins: number;
}> = [
  // Content creation activities
  { method: 'POST', pathPattern: /\/api\/v[12]\/content\/publish/, activityType: 'content_creation', estimatedMins: 30 },
  { method: 'PUT',  pathPattern: /\/api\/v[12]\/content\//, activityType: 'content_creation', estimatedMins: 15 },

  // Engagement activities
  { method: 'POST', pathPattern: /\/api\/v[12]\/messages/, activityType: 'engagement', estimatedMins: 5 },
  { method: 'POST', pathPattern: /\/api\/v[12]\/inbox\/reply/, activityType: 'engagement', estimatedMins: 5 },

  // Management activities
  { method: 'GET',  pathPattern: /\/api\/v[12]\/analytics/, activityType: 'management', estimatedMins: 10 },
  { method: 'PUT',  pathPattern: /\/api\/v[12]\/settings/, activityType: 'management', estimatedMins: 5 },
];

/**
 * Express middleware that passively records creator work activity.
 * Runs AFTER the route handler succeeds (non-blocking, fire-and-forget).
 * Only tracks authenticated creators. Never delays the response.
 */
export function workTrackingMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Hook into response finish event (non-blocking)
  res.on('finish', () => {
    // Only track successful responses from authenticated creators
    if (res.statusCode >= 400 || !req.user?.nostr_pubkey) return;

    const rule = TRACKING_RULES.find(
      r => r.method === req.method && r.pathPattern.test(req.originalUrl)
    );
    if (!rule) return;

    // Fire-and-forget: do not await, do not block response
    const service = container.resolve<IWellnessService>(TYPES.WellnessService);
    const input: CreateWorkPatternInput = {
      type: rule.activityType,
      duration_mins: rule.estimatedMins,
      timestamp: new Date().toISOString(),
      metadata: { source: 'auto-tracking', route: req.originalUrl },
    };

    service.recordWorkPattern(req.user.nostr_pubkey, input).catch(() => {
      // Silently ignore tracking failures — never disrupt the user's workflow
    });
  });

  next();
}
```

**Registration**: Mount in `app.ts` after authentication middleware, before route handlers:
```typescript
app.use(workTrackingMiddleware);
```

### 10.2 GAP-2 Fix: Wellness Resource Library Static Data (EPIC-007, US-E7-008)

**Problem**: `WellnessResources.tsx` component exists but has no backing data file.

**Solution**: Create `packages/frontend/src/features/wellness/data/resources.ts`

```typescript
export interface WellnessResource {
  id: string;
  title: string;
  description: string;
  url: string;
  category: 'communities' | 'articles' | 'tools' | 'crisis';
  tags: string[];
}

export const WELLNESS_RESOURCES: WellnessResource[] = [
  // Crisis Resources (always visible per AC-5)
  { id: 'cr-1', title: 'Crisis Text Line', description: 'Free 24/7 crisis support via text', url: 'https://www.crisistextline.org/', category: 'crisis', tags: ['immediate', 'text'] },
  { id: 'cr-2', title: '988 Suicide & Crisis Lifeline', description: 'Call or text 988 for immediate support', url: 'https://988lifeline.org/', category: 'crisis', tags: ['immediate', 'phone'] },
  { id: 'cr-3', title: 'SAMHSA Helpline', description: 'Free referral and information service', url: 'https://www.samhsa.gov/find-help/national-helpline', category: 'crisis', tags: ['referral'] },
  { id: 'cr-4', title: 'International Association for Suicide Prevention', description: 'Crisis centers worldwide', url: 'https://www.iasp.info/resources/Crisis_Centres/', category: 'crisis', tags: ['international'] },
  { id: 'cr-5', title: 'BetterHelp', description: 'Online therapy and counseling', url: 'https://www.betterhelp.com/', category: 'crisis', tags: ['therapy', 'online'] },

  // Communities (5+)
  { id: 'cm-1', title: 'Creator Burnout Reddit', description: 'Community of creators discussing burnout and recovery', url: 'https://reddit.com/r/CreatorBurnout', category: 'communities', tags: ['peer-support'] },
  { id: 'cm-2', title: 'The Creator Economy', description: 'Discord community for sustainable content creation', url: 'https://discord.gg/creator-economy', category: 'communities', tags: ['discord'] },
  { id: 'cm-3', title: 'Indie Hackers', description: 'Community of founders building sustainable businesses', url: 'https://www.indiehackers.com/', category: 'communities', tags: ['entrepreneurship'] },
  { id: 'cm-4', title: 'NOSTR Creator Community', description: 'NOSTR-native creator support group', url: 'https://nostr.com/communities/creators', category: 'communities', tags: ['nostr', 'decentralized'] },
  { id: 'cm-5', title: 'The Balanced Creator', description: 'Newsletter community focused on sustainable creativity', url: 'https://balancedcreator.com/', category: 'communities', tags: ['newsletter'] },

  // Articles (5+)
  { id: 'ar-1', title: 'The Science of Creator Burnout', description: 'Research-backed overview of burnout in creative professions', url: 'https://hbr.org/burnout', category: 'articles', tags: ['research'] },
  { id: 'ar-2', title: 'Sustainable Content Creation Guide', description: 'Practical framework for long-term content production', url: 'https://creatoreconomy.so/sustainable-guide', category: 'articles', tags: ['guide'] },
  { id: 'ar-3', title: 'Setting Boundaries as a Creator', description: 'How to protect your time and energy', url: 'https://aliabdaal.com/boundaries', category: 'articles', tags: ['boundaries'] },
  { id: 'ar-4', title: 'The Pomodoro Technique for Creators', description: 'Time management adapted for creative work', url: 'https://todoist.com/productivity-methods/pomodoro-technique', category: 'articles', tags: ['productivity'] },
  { id: 'ar-5', title: 'Digital Minimalism for Creators', description: 'Reducing screen time while maintaining output', url: 'https://calnewport.com/digital-minimalism/', category: 'articles', tags: ['digital-wellness'] },

  // Tools (5+)
  { id: 'tl-1', title: 'Notion', description: 'Content calendar and planning workspace', url: 'https://notion.so/', category: 'tools', tags: ['planning'] },
  { id: 'tl-2', title: 'Headspace', description: 'Meditation and mindfulness app', url: 'https://www.headspace.com/', category: 'tools', tags: ['meditation'] },
  { id: 'tl-3', title: 'RescueTime', description: 'Automatic time tracking and focus tools', url: 'https://www.rescuetime.com/', category: 'tools', tags: ['time-tracking'] },
  { id: 'tl-4', title: 'Forest App', description: 'Focus timer that grows virtual trees', url: 'https://www.forestapp.cc/', category: 'tools', tags: ['focus'] },
  { id: 'tl-5', title: 'Calm', description: 'Sleep stories and relaxation exercises', url: 'https://www.calm.com/', category: 'tools', tags: ['sleep', 'relaxation'] },
];

/** Crisis resources must always be shown first, per US-E7-008 AC-5 */
export function getResourcesByCategory(category?: string): WellnessResource[] {
  if (!category || category === 'all') return WELLNESS_RESOURCES;
  return WELLNESS_RESOURCES.filter(r => r.category === category);
}

export function getCrisisResources(): WellnessResource[] {
  return WELLNESS_RESOURCES.filter(r => r.category === 'crisis');
}
```

### 10.3 GAP-3 Fix: Provenance Versioning for Edited Content (EPIC-008, US-E8-002 EC-2)

**Problem**: `provenance_records` uses `content_id` as PRIMARY KEY, allowing only one record per content. Edited content that is re-signed needs a new provenance record linking to the original.

**Solution**: Change PK to `id UUID` and add `version` + `supersedes` columns.

**Updated DDL** (replaces Section 3.3 `provenance_records`):

```sql
CREATE TABLE provenance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  supersedes_id UUID REFERENCES provenance_records(id),  -- links to previous version
  creator_id TEXT NOT NULL,
  signature TEXT NOT NULL,
  nostr_event_id TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  relay_confirmations JSONB NOT NULL DEFAULT '[]',
  verification_status TEXT NOT NULL DEFAULT 'verified'
    CHECK (verification_status IN ('verified','unverified','disputed')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','revoked','superseded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(content_id, version)
);

-- Indexes
CREATE INDEX idx_provenance_creator ON provenance_records(creator_id);
CREATE INDEX idx_provenance_content ON provenance_records(content_id);
CREATE INDEX idx_provenance_nostr_event ON provenance_records(nostr_event_id);
CREATE INDEX idx_provenance_content_latest ON provenance_records(content_id, version DESC);

-- RLS: anyone can read (public verification), only creator can insert
ALTER TABLE provenance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read provenance records"
  ON provenance_records FOR SELECT USING (true);
CREATE POLICY "Creators can insert own provenance"
  ON provenance_records FOR INSERT
  WITH CHECK (creator_id = auth.uid()::TEXT);

-- Immutability trigger: only status column can be updated
CREATE OR REPLACE FUNCTION enforce_provenance_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.signature != OLD.signature OR NEW.content_hash != OLD.content_hash
     OR NEW.nostr_event_id != OLD.nostr_event_id OR NEW.creator_id != OLD.creator_id
     OR NEW.version != OLD.version OR NEW.content_id != OLD.content_id THEN
    RAISE EXCEPTION 'Provenance records are immutable. Only status can be updated.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_provenance_immutability
  BEFORE UPDATE ON provenance_records
  FOR EACH ROW EXECUTE FUNCTION enforce_provenance_immutability();
```

**API impact**: `GET /api/v2/shield/provenance/:contentId` returns the latest version by default. Add optional `?version=N` query param to retrieve a specific version. `ProvenanceService.getProvenanceChain()` updated to ORDER BY version DESC LIMIT 1.

**Re-signing flow** (content edit):
1. Load existing provenance for content_id (latest version)
2. Set existing record status to `superseded`
3. Insert new record with `version = previous + 1`, `supersedes_id = previous.id`
4. New record has fresh signature and content_hash

### 10.4 GAP-4 Fix: Encryption Key Versioning (EPIC-009, US-E9-001 EC-1)

**Problem**: `platform_connections` table has no way to track which encryption key version was used, blocking key rotation.

**Solution**: Add `encryption_key_version` column.

**Updated DDL** (add to `platform_connections`):

```sql
-- Add to platform_connections table definition:
  encryption_key_version INTEGER NOT NULL DEFAULT 1,
```

**Updated encryption utilities**:

```typescript
// packages/backend/src/services/distribution/crypto.ts

export function encryptToken(
  plaintext: string,
  key: Buffer,
  keyVersion: number
): { encrypted: Buffer; iv: Buffer; authTag: Buffer; keyVersion: number } {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { encrypted, iv, authTag, keyVersion };
}

export function decryptToken(
  encrypted: Buffer,
  key: Buffer,
  iv: Buffer,
  authTag: Buffer
): string {
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
```

**PlatformConnectionService key resolution**:

```typescript
async function getEncryptionKey(version: number): Promise<Buffer> {
  const secretName = version === 1
    ? 'PLATFORM_TOKEN_ENCRYPTION_KEY'
    : `PLATFORM_TOKEN_ENCRYPTION_KEY_V${version}`;
  const keyHex = await secretsService.getSecret(secretName);
  return Buffer.from(keyHex, 'hex');
}
```

**Key rotation batch job**: When rotating keys, a BullMQ job iterates all `platform_connections`, decrypts with old key version, re-encrypts with new key version, and updates `encryption_key_version`.

### 10.5 OBS-1 Fix: Mastodon Multi-Instance Support

**Problem**: `UNIQUE(creator_id, platform)` prevents connecting to multiple Mastodon instances.

**Solution**: Change unique constraint to include `instance_url`.

```sql
-- Replace: UNIQUE(creator_id, platform)
-- With:
UNIQUE(creator_id, platform, COALESCE(instance_url, ''))
```

This allows a creator to connect to `mastodon.social` and `hachyderm.io` simultaneously while still preventing duplicate connections to the same instance.

### 10.6 OBS-2 Fix: Cross-Publish Retry Backoff

**Problem**: Original backoff (5s/20s/60s, 3 retries) is too aggressive for platforms with strict rate limits.

**Solution**: Increase to 4 retries with longer backoff.

**Updated queue config for `cross-publish`**:

| Queue | Concurrency | Max Retries | Backoff | Priority Levels |
|-------|-------------|-------------|---------|-----------------|
| `cross-publish` | 5 | 4 | Exponential (30s, 120s, 300s, 3600s) | urgent, normal |

```typescript
// In CrossPostService when adding job:
await queueService.addJob('cross-publish', 'publish', data, {
  attempts: 4,
  backoff: { type: 'exponential', delay: 30000 }, // 30s → 120s → 300s → ~1h
});
```

This gives platforms time to reset rate limits between retries.
