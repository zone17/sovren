# Phase 7: Database Schema

All tables use Supabase (PostgreSQL). Row Level Security (RLS) is enabled on all tables. UUIDs are used for primary keys. Timestamps use `timestamptz`.

---

## EPIC-007: Creator Wellness Tables

### `wellness_snapshots`

Stores pulse check-in data (energy, motivation, stress) from optional weekly wellness surveys.

```sql
CREATE TABLE wellness_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id    TEXT NOT NULL,          -- NOSTR pubkey hex
  energy        SMALLINT NOT NULL CHECK (energy BETWEEN 1 AND 5),
  motivation    SMALLINT NOT NULL CHECK (motivation BETWEEN 1 AND 5),
  stress        SMALLINT NOT NULL CHECK (stress BETWEEN 1 AND 5),
  composite_score NUMERIC(3,2) GENERATED ALWAYS AS (
    (energy + motivation + (6 - stress))::NUMERIC / 3
  ) STORED,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_wellness_snapshots_creator_date
  ON wellness_snapshots (creator_id, created_at DESC);

-- RLS
ALTER TABLE wellness_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators can manage own snapshots"
  ON wellness_snapshots
  FOR ALL
  USING (creator_id = auth.uid()::TEXT)
  WITH CHECK (creator_id = auth.uid()::TEXT);
```

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | No | Primary key |
| `creator_id` | TEXT | No | NOSTR pubkey (hex) — the creator who owns this data |
| `energy` | SMALLINT | No | 1-5 scale |
| `motivation` | SMALLINT | No | 1-5 scale |
| `stress` | SMALLINT | No | 1-5 scale (1=low stress, 5=high stress) |
| `composite_score` | NUMERIC(3,2) | No | Computed: (energy + motivation + (6-stress)) / 3 |
| `created_at` | TIMESTAMPTZ | No | Check-in timestamp |

---

### `creator_work_patterns`

Tracks daily work activity broken down by type. One row per creator per date.

```sql
CREATE TABLE creator_work_patterns (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id            TEXT NOT NULL,          -- NOSTR pubkey hex
  date                  DATE NOT NULL,
  content_time_mins     INTEGER NOT NULL DEFAULT 0 CHECK (content_time_mins >= 0),
  engagement_time_mins  INTEGER NOT NULL DEFAULT 0 CHECK (engagement_time_mins >= 0),
  management_time_mins  INTEGER NOT NULL DEFAULT 0 CHECK (management_time_mins >= 0),
  total_hours           NUMERIC(5,2) GENERATED ALWAYS AS (
    (content_time_mins + engagement_time_mins + management_time_mins)::NUMERIC / 60
  ) STORED,
  post_count            INTEGER NOT NULL DEFAULT 0 CHECK (post_count >= 0),
  first_activity_at     TIMESTAMPTZ,
  last_activity_at      TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (creator_id, date)
);

-- Indexes
CREATE INDEX idx_creator_work_patterns_creator_date
  ON creator_work_patterns (creator_id, date DESC);
CREATE INDEX idx_creator_work_patterns_date
  ON creator_work_patterns (date);

-- RLS
ALTER TABLE creator_work_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators can manage own patterns"
  ON creator_work_patterns
  FOR ALL
  USING (creator_id = auth.uid()::TEXT)
  WITH CHECK (creator_id = auth.uid()::TEXT);
```

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | No | Primary key |
| `creator_id` | TEXT | No | NOSTR pubkey (hex) |
| `date` | DATE | No | Activity date |
| `content_time_mins` | INTEGER | No | Minutes spent on content creation |
| `engagement_time_mins` | INTEGER | No | Minutes spent on engagement (DMs, comments) |
| `management_time_mins` | INTEGER | No | Minutes spent on management (analytics, settings) |
| `total_hours` | NUMERIC(5,2) | No | Computed total hours |
| `post_count` | INTEGER | No | Number of posts published this day |
| `first_activity_at` | TIMESTAMPTZ | Yes | Earliest activity timestamp |
| `last_activity_at` | TIMESTAMPTZ | Yes | Latest activity timestamp |
| `created_at` | TIMESTAMPTZ | No | Row creation |
| `updated_at` | TIMESTAMPTZ | No | Last update |

The `UNIQUE (creator_id, date)` constraint ensures one row per creator per day. The auto-tracking middleware uses `INSERT ... ON CONFLICT` (upsert) to increment minutes.

---

### `creator_boundaries`

Stores boundary configuration per creator (one row per creator).

```sql
CREATE TABLE creator_boundaries (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id                  TEXT NOT NULL UNIQUE,   -- NOSTR pubkey hex
  focus_hours_enabled         BOOLEAN NOT NULL DEFAULT FALSE,
  focus_hours_start           TIME,                   -- e.g., '22:00'
  focus_hours_end             TIME,                   -- e.g., '08:00'
  focus_hours_timezone        TEXT DEFAULT 'UTC',
  focus_hours_days            TEXT[] DEFAULT '{}',     -- e.g., {'monday','tuesday',...}
  weekly_engagement_budget_mins INTEGER DEFAULT 0,
  dnd_active                  BOOLEAN NOT NULL DEFAULT FALSE,
  auto_response_enabled       BOOLEAN NOT NULL DEFAULT FALSE,
  auto_response_template      TEXT DEFAULT '',
  availability_status         TEXT NOT NULL DEFAULT 'hidden'
                              CHECK (availability_status IN ('hidden', 'available', 'creating', 'offline')),
  availability_public         BOOLEAN NOT NULL DEFAULT FALSE,  -- BR-006b: opt-in, hidden by default
  notification_batching       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE creator_boundaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators can manage own boundaries"
  ON creator_boundaries
  FOR ALL
  USING (creator_id = auth.uid()::TEXT)
  WITH CHECK (creator_id = auth.uid()::TEXT);

-- Public read for availability_status (supporters can see creator status)
CREATE POLICY "Anyone can read availability status"
  ON creator_boundaries
  FOR SELECT
  USING (TRUE);
  -- Note: Application layer restricts which columns are returned to non-owners
```

---

### `burnout_risk_history`

Weekly snapshots of the burnout risk score for trend tracking.

```sql
CREATE TABLE burnout_risk_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id    TEXT NOT NULL,
  week          TEXT NOT NULL,              -- ISO week format: '2026-W07'
  score         SMALLINT NOT NULL CHECK (score BETWEEN 0 AND 100),
  level         TEXT NOT NULL CHECK (level IN ('low', 'moderate', 'high', 'critical')),
  factors       JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (creator_id, week)
);

-- Index
CREATE INDEX idx_burnout_risk_creator_week
  ON burnout_risk_history (creator_id, week DESC);

-- RLS
ALTER TABLE burnout_risk_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators can read own risk history"
  ON burnout_risk_history
  FOR ALL
  USING (creator_id = auth.uid()::TEXT)
  WITH CHECK (creator_id = auth.uid()::TEXT);
```

---

## EPIC-008: Content Shield Tables

### `provenance_records`

Stores the cryptographic provenance chain for each content piece.

```sql
CREATE TABLE provenance_records (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id            TEXT NOT NULL UNIQUE,     -- Content UUID from existing content system
  creator_id            TEXT NOT NULL,             -- NOSTR pubkey hex
  nostr_event_id        TEXT NOT NULL,             -- NOSTR event ID (hex)
  signature             TEXT NOT NULL,             -- NOSTR event signature (hex)
  content_hash          TEXT NOT NULL,             -- SHA-256 of content body
  relay_confirmations   JSONB NOT NULL DEFAULT '[]',
  verification_status   TEXT NOT NULL DEFAULT 'verified'
                        CHECK (verification_status IN ('verified', 'unverified', 'disputed')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_provenance_creator
  ON provenance_records (creator_id, created_at DESC);
CREATE INDEX idx_provenance_nostr_event
  ON provenance_records (nostr_event_id);
CREATE INDEX idx_provenance_content_hash
  ON provenance_records (content_hash);

-- RLS: Provenance is public for reads, immutable after creation (no UPDATE/DELETE)
ALTER TABLE provenance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read provenance"
  ON provenance_records
  FOR SELECT
  USING (TRUE);

CREATE POLICY "Creators can insert own provenance"
  ON provenance_records
  FOR INSERT
  WITH CHECK (creator_id = auth.uid()::TEXT);

-- BR-E8-001: Provenance records are IMMUTABLE — no UPDATE or DELETE policies granted.
-- This means no RLS policy exists for UPDATE or DELETE, so those operations are denied.
```

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | No | Primary key |
| `content_id` | TEXT | No | Unique reference to the content piece |
| `creator_id` | TEXT | No | NOSTR pubkey of the author |
| `nostr_event_id` | TEXT | No | NOSTR event ID containing the signed content |
| `signature` | TEXT | No | Schnorr signature from NOSTR event |
| `content_hash` | TEXT | No | SHA-256 hash of the raw content |
| `relay_confirmations` | JSONB | No | Array of `{relay, confirmed_at}` objects |
| `verification_status` | TEXT | No | Current verification state |
| `created_at` | TIMESTAMPTZ | No | Signing timestamp |

---

### `content_fingerprints`

Stores perceptual hashes for content pieces (text and images).

```sql
CREATE TABLE content_fingerprints (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id    TEXT NOT NULL,                -- Content UUID
  creator_id    TEXT NOT NULL,                -- NOSTR pubkey hex
  hash_type     TEXT NOT NULL CHECK (hash_type IN ('simhash', 'phash')),
  hash_value    TEXT NOT NULL,                -- Hex-encoded hash
  content_type  TEXT NOT NULL CHECK (content_type IN ('text', 'image')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (content_id, hash_type)
);

-- Indexes
CREATE INDEX idx_fingerprints_creator
  ON content_fingerprints (creator_id);
CREATE INDEX idx_fingerprints_hash_type_value
  ON content_fingerprints (hash_type, hash_value);
CREATE INDEX idx_fingerprints_content
  ON content_fingerprints (content_id);

-- RLS
ALTER TABLE content_fingerprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators can manage own fingerprints"
  ON content_fingerprints
  FOR ALL
  USING (creator_id = auth.uid()::TEXT)
  WITH CHECK (creator_id = auth.uid()::TEXT);

-- Fingerprint hashes are public for verification comparison
CREATE POLICY "Anyone can read fingerprint hashes"
  ON content_fingerprints
  FOR SELECT
  USING (TRUE);
```

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | No | Primary key |
| `content_id` | TEXT | No | Content piece this fingerprint belongs to |
| `creator_id` | TEXT | No | NOSTR pubkey of the content owner |
| `hash_type` | TEXT | No | `simhash` for text, `phash` for images |
| `hash_value` | TEXT | No | Hex-encoded perceptual hash |
| `content_type` | TEXT | No | `text` or `image` |
| `created_at` | TIMESTAMPTZ | No | Fingerprint creation timestamp |

---

### `content_alerts`

Stores copy detection alerts from the NOSTR relay scanner.

```sql
CREATE TABLE content_alerts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id              TEXT NOT NULL,                -- Alert owner (NOSTR pubkey)
  original_content_id     TEXT NOT NULL,                -- Reference to original content
  detected_copy_url       TEXT NOT NULL,                -- NOSTR event URI or URL
  detected_author_pubkey  TEXT,                         -- Pubkey of detected copier
  detected_event_id       TEXT,                          -- NOSTR event ID of detected copy
  similarity_score        NUMERIC(4,3) NOT NULL CHECK (similarity_score BETWEEN 0 AND 1),
  match_level             TEXT NOT NULL CHECK (match_level IN ('exact_copy', 'derivative', 'coincidental')),
  hash_type               TEXT NOT NULL CHECK (hash_type IN ('simhash', 'phash')),
  status                  TEXT NOT NULL DEFAULT 'new'
                          CHECK (status IN ('new', 'reviewed', 'resolved', 'false_positive', 'reported')),
  relay                   TEXT,                         -- Relay where copy was found
  detected_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_alerts_creator_status
  ON content_alerts (creator_id, status, detected_at DESC);
CREATE INDEX idx_alerts_original_content
  ON content_alerts (original_content_id);

-- RLS
ALTER TABLE content_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators can manage own alerts"
  ON content_alerts
  FOR ALL
  USING (creator_id = auth.uid()::TEXT)
  WITH CHECK (creator_id = auth.uid()::TEXT);
```

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | No | Primary key |
| `creator_id` | TEXT | No | Alert owner (content author) |
| `original_content_id` | TEXT | No | ID of the original content that was copied |
| `detected_copy_url` | TEXT | No | NOSTR event URI or web URL of the copy |
| `detected_author_pubkey` | TEXT | Yes | NOSTR pubkey of the suspected copier |
| `detected_event_id` | TEXT | Yes | NOSTR event ID of the detected copy |
| `similarity_score` | NUMERIC(4,3) | No | 0.000 to 1.000 similarity |
| `match_level` | TEXT | No | `exact_copy`, `derivative`, or `coincidental` |
| `hash_type` | TEXT | No | Hash algorithm used for comparison |
| `status` | TEXT | No | Alert lifecycle state |
| `relay` | TEXT | Yes | NOSTR relay where the copy was detected |
| `detected_at` | TIMESTAMPTZ | No | When the copy was first detected |
| `updated_at` | TIMESTAMPTZ | No | Last status change |

---

## Entity Relationship Diagram

```
                    ┌──────────────────┐
                    │    creator_id    │ (NOSTR pubkey - shared key)
                    └────────┬─────────┘
                             │
         ┌───────────────────┼───────────────────────────────┐
         │                   │                               │
         ▼                   ▼                               ▼
┌─────────────────┐ ┌────────────────────┐ ┌──────────────────────┐
│wellness_snapshots│ │creator_work_patterns│ │ creator_boundaries   │
│(pulse check-ins) │ │(daily work log)     │ │(focus hours, DND)    │
└─────────────────┘ └────────────────────┘ └──────────────────────┘
                             │
                             ▼
                    ┌────────────────────┐
                    │burnout_risk_history│
                    │(weekly score snaps) │
                    └────────────────────┘

         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────────┐ ┌──────────────────┐ ┌──────────────┐
│provenance_records│ │content_fingerprints│ │content_alerts│
│(signing chain)   │ │(simhash/phash)    │ │(copy alerts) │
└────────┬────────┘ └────────┬─────────┘ └──────┬───────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
                    ┌────────┴────────┐
                    │   content_id    │ (shared foreign reference)
                    └─────────────────┘
```

---

## Migration Strategy

A single Supabase migration file creates all tables:

```
packages/backend/src/database/migrations/
  YYYYMMDDHHMMSS_phase7_creator_safety_net.sql
```

The migration is idempotent (`CREATE TABLE IF NOT EXISTS`) and includes:
1. All 7 tables
2. All indexes
3. All RLS policies
4. Updated `updated_at` triggers (via Supabase's `moddatetime` extension)

Migration is safe to run on both clean databases and existing databases with v1 data.

---

## Aggregate Queries (for Benchmarking Endpoint)

The anonymous benchmarking endpoint uses materialized aggregates that run as a daily scheduled job:

```sql
-- Materialized view for anonymous benchmarking (refreshed daily)
CREATE MATERIALIZED VIEW IF NOT EXISTS wellness_benchmarks AS
SELECT
  AVG(total_hours)::NUMERIC(5,2) AS avg_weekly_hours,
  PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY total_hours)::NUMERIC(5,2) AS p25_hours,
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY total_hours)::NUMERIC(5,2) AS p50_hours,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY total_hours)::NUMERIC(5,2) AS p75_hours,
  COUNT(DISTINCT creator_id) AS sample_size
FROM (
  SELECT creator_id, SUM(total_hours) AS total_hours
  FROM creator_work_patterns
  WHERE date >= CURRENT_DATE - INTERVAL '7 days'
  GROUP BY creator_id
) weekly_totals;
```

No individual creator data is ever exposed through this view.
