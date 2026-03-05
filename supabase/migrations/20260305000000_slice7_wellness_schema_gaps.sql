-- Slice 7: Shield + Business Advanced — Schema Alignment
-- Adds missing columns to 3 wellness tables so existing services can function.
-- All DDL is idempotent (ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS).
-- No column renames, no type changes, no drops. Fully backwards-compatible.

-- ============================================================================
-- 1. creator_boundaries — 12 new columns
-- ============================================================================

ALTER TABLE creator_boundaries ADD COLUMN IF NOT EXISTS focus_hours_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE creator_boundaries ADD COLUMN IF NOT EXISTS focus_hours_start TEXT NOT NULL DEFAULT '22:00';
ALTER TABLE creator_boundaries ADD COLUMN IF NOT EXISTS focus_hours_end TEXT NOT NULL DEFAULT '08:00';
ALTER TABLE creator_boundaries ADD COLUMN IF NOT EXISTS focus_hours_timezone TEXT NOT NULL DEFAULT 'UTC';
ALTER TABLE creator_boundaries ADD COLUMN IF NOT EXISTS focus_hours_days TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE creator_boundaries ADD COLUMN IF NOT EXISTS weekly_engagement_budget_mins INTEGER NOT NULL DEFAULT 0 CHECK (weekly_engagement_budget_mins >= 0);
ALTER TABLE creator_boundaries ADD COLUMN IF NOT EXISTS dnd_active BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE creator_boundaries ADD COLUMN IF NOT EXISTS auto_response_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE creator_boundaries ADD COLUMN IF NOT EXISTS auto_response_template TEXT NOT NULL DEFAULT '' CHECK (length(auto_response_template) <= 500);
ALTER TABLE creator_boundaries ADD COLUMN IF NOT EXISTS availability_status TEXT NOT NULL DEFAULT 'hidden' CHECK (availability_status IN ('hidden', 'available', 'creating', 'offline'));
ALTER TABLE creator_boundaries ADD COLUMN IF NOT EXISTS availability_public BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE creator_boundaries ADD COLUMN IF NOT EXISTS notification_batching BOOLEAN NOT NULL DEFAULT false;

-- ============================================================================
-- 2. wellness_snapshots — 3 new columns + UNIQUE constraint + index
-- ============================================================================

ALTER TABLE wellness_snapshots ADD COLUMN IF NOT EXISTS energy INTEGER CHECK (energy BETWEEN 1 AND 5);
ALTER TABLE wellness_snapshots ADD COLUMN IF NOT EXISTS motivation INTEGER CHECK (motivation BETWEEN 1 AND 5);
ALTER TABLE wellness_snapshots ADD COLUMN IF NOT EXISTS stress INTEGER CHECK (stress BETWEEN 1 AND 5);

CREATE INDEX IF NOT EXISTS idx_wellness_snapshots_creator_id ON wellness_snapshots(creator_id);

-- UNIQUE constraint for pulse frequency guard (one per creator per day) — TOCTOU-safe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_wellness_snapshots_creator_day'
  ) THEN
    CREATE UNIQUE INDEX idx_wellness_snapshots_creator_day
      ON wellness_snapshots (creator_id, (created_at::date));
  END IF;
END $$;

-- ============================================================================
-- 3. burnout_risk_history — 3 new columns + UNIQUE constraint + index
-- ============================================================================

ALTER TABLE burnout_risk_history ADD COLUMN IF NOT EXISTS week TEXT;
ALTER TABLE burnout_risk_history ADD COLUMN IF NOT EXISTS score INTEGER CHECK (score BETWEEN 0 AND 100);
ALTER TABLE burnout_risk_history ADD COLUMN IF NOT EXISTS level TEXT CHECK (level IN ('low', 'moderate', 'high', 'critical'));

CREATE INDEX IF NOT EXISTS idx_burnout_risk_creator_week ON burnout_risk_history(creator_id, week);

-- UNIQUE constraint for upsert on (creator_id, week)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'burnout_risk_history_creator_week_key'
  ) THEN
    ALTER TABLE burnout_risk_history
      ADD CONSTRAINT burnout_risk_history_creator_week_key UNIQUE (creator_id, week);
  END IF;
END $$;

-- ============================================================================
-- 4. Backfill existing burnout_risk_history rows
-- ============================================================================

UPDATE burnout_risk_history
SET score = ROUND(risk_score)::integer,
    level = risk_level
WHERE score IS NULL AND risk_score IS NOT NULL;
