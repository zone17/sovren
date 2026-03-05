-- Slice 7: Shield + Business Advanced — Schema Alignment
-- Adds missing columns to 3 wellness tables so existing services can function.
-- All DDL is idempotent (ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS).
-- No column renames, no type changes, no drops. Fully backwards-compatible.
--
-- Wrapped in explicit transaction for atomicity.
-- Dedup uses CTE + ROW_NUMBER (O(n log n)) instead of NOT IN (O(n²)).

BEGIN;

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
-- 2. wellness_snapshots — 3 new columns + backfill + NOT NULL + UNIQUE + index
-- ============================================================================

ALTER TABLE wellness_snapshots ADD COLUMN IF NOT EXISTS energy INTEGER CHECK (energy BETWEEN 1 AND 5);
ALTER TABLE wellness_snapshots ADD COLUMN IF NOT EXISTS motivation INTEGER CHECK (motivation BETWEEN 1 AND 5);
ALTER TABLE wellness_snapshots ADD COLUMN IF NOT EXISTS stress INTEGER CHECK (stress BETWEEN 1 AND 5);

-- #668: Backfill existing rows with neutral midpoint (3 on 1-5 scale), then enforce NOT NULL
UPDATE wellness_snapshots SET energy = 3 WHERE energy IS NULL;
UPDATE wellness_snapshots SET motivation = 3 WHERE motivation IS NULL;
UPDATE wellness_snapshots SET stress = 3 WHERE stress IS NULL;

ALTER TABLE wellness_snapshots ALTER COLUMN energy SET NOT NULL;
ALTER TABLE wellness_snapshots ALTER COLUMN motivation SET NOT NULL;
ALTER TABLE wellness_snapshots ALTER COLUMN stress SET NOT NULL;

-- #654/#657: Deduplicate before adding UNIQUE constraint (keeps latest row per creator+day)
-- Uses CTE + ROW_NUMBER (O(n log n)) instead of NOT IN (O(n²))
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY creator_id, created_at::date
    ORDER BY created_at DESC
  ) AS rn
  FROM wellness_snapshots
  WHERE created_at IS NOT NULL
)
DELETE FROM wellness_snapshots
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

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
-- 3. burnout_risk_history — 3 new columns + backfill + dedup + UNIQUE + index
-- ============================================================================

ALTER TABLE burnout_risk_history ADD COLUMN IF NOT EXISTS week TEXT;
ALTER TABLE burnout_risk_history ADD COLUMN IF NOT EXISTS score INTEGER CHECK (score BETWEEN 0 AND 100);
ALTER TABLE burnout_risk_history ADD COLUMN IF NOT EXISTS level TEXT CHECK (level IN ('low', 'moderate', 'high', 'critical'));

-- #662: Backfill week from created_at for existing rows
UPDATE burnout_risk_history
SET week = to_char(created_at, 'IYYY-"W"IW')
WHERE week IS NULL AND created_at IS NOT NULL;

-- Remove unbackfillable rows (no created_at, no week derivable)
DELETE FROM burnout_risk_history WHERE week IS NULL AND created_at IS NULL;

-- #654: After backfill, enforce NOT NULL on week
ALTER TABLE burnout_risk_history ALTER COLUMN week SET NOT NULL;

-- #654: Dedup burnout_risk_history by (creator_id, week) keeping latest
-- Must run BEFORE adding UNIQUE constraint
WITH ranked_burnout AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY creator_id, week
    ORDER BY created_at DESC NULLS LAST
  ) AS rn
  FROM burnout_risk_history
)
DELETE FROM burnout_risk_history
WHERE id IN (SELECT id FROM ranked_burnout WHERE rn > 1);

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

-- #658 + #678: Normalize level to valid CHECK values with fallback; clamp score to [0, 100]
UPDATE burnout_risk_history
SET score = GREATEST(0, LEAST(100, ROUND(risk_score)::integer)),
    level = CASE
      WHEN risk_level IN ('low', 'moderate', 'high', 'critical') THEN risk_level
      ELSE 'moderate'
    END
WHERE score IS NULL AND risk_score IS NOT NULL;

COMMIT;

-- ============================================================================
-- ROLLBACK (manual — uncomment to revert)
-- WARNING: Dedup deletes and backfills are NOT reversible.
--          Re-running migration after rollback will re-dedup (safe but destructive).
-- ============================================================================
-- BEGIN;
--
-- -- wellness_snapshots
-- DROP INDEX IF EXISTS idx_wellness_snapshots_creator_day;
-- ALTER TABLE wellness_snapshots ALTER COLUMN energy DROP NOT NULL;
-- ALTER TABLE wellness_snapshots ALTER COLUMN motivation DROP NOT NULL;
-- ALTER TABLE wellness_snapshots ALTER COLUMN stress DROP NOT NULL;
-- ALTER TABLE wellness_snapshots DROP COLUMN IF EXISTS energy;
-- ALTER TABLE wellness_snapshots DROP COLUMN IF EXISTS motivation;
-- ALTER TABLE wellness_snapshots DROP COLUMN IF EXISTS stress;
--
-- -- burnout_risk_history
-- ALTER TABLE burnout_risk_history DROP CONSTRAINT IF EXISTS burnout_risk_history_creator_week_key;
-- ALTER TABLE burnout_risk_history ALTER COLUMN week DROP NOT NULL;
-- ALTER TABLE burnout_risk_history DROP COLUMN IF EXISTS week;
-- ALTER TABLE burnout_risk_history DROP COLUMN IF EXISTS score;
-- ALTER TABLE burnout_risk_history DROP COLUMN IF EXISTS level;
--
-- -- creator_boundaries (12 columns)
-- ALTER TABLE creator_boundaries DROP COLUMN IF EXISTS focus_hours_enabled;
-- ALTER TABLE creator_boundaries DROP COLUMN IF EXISTS focus_hours_start;
-- ALTER TABLE creator_boundaries DROP COLUMN IF EXISTS focus_hours_end;
-- ALTER TABLE creator_boundaries DROP COLUMN IF EXISTS focus_hours_timezone;
-- ALTER TABLE creator_boundaries DROP COLUMN IF EXISTS focus_hours_days;
-- ALTER TABLE creator_boundaries DROP COLUMN IF EXISTS weekly_engagement_budget_mins;
-- ALTER TABLE creator_boundaries DROP COLUMN IF EXISTS dnd_active;
-- ALTER TABLE creator_boundaries DROP COLUMN IF EXISTS auto_response_enabled;
-- ALTER TABLE creator_boundaries DROP COLUMN IF EXISTS auto_response_template;
-- ALTER TABLE creator_boundaries DROP COLUMN IF EXISTS availability_status;
-- ALTER TABLE creator_boundaries DROP COLUMN IF EXISTS availability_public;
-- ALTER TABLE creator_boundaries DROP COLUMN IF EXISTS notification_batching;
--
-- -- WARNING: wellness_snapshots dedup is irreversible — deleted duplicate rows cannot be restored.
-- -- WARNING: burnout_risk_history dedup is irreversible — deleted duplicate rows cannot be restored.
-- -- WARNING: Backfill of energy/motivation/stress to 3 overwrites NULL — original NULL state unrecoverable.
-- -- WARNING: Backfill of week from created_at is non-reversible — original NULL week rows deleted.
--
-- COMMIT;
