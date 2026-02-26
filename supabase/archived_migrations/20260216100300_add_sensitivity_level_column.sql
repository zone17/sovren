-- Todo 153: Persist sensitivity settings
-- Adds sensitivity_level column to creator_boundaries table (or creates preferences table)
-- Replaces in-memory Map in BurnoutScoringService

-- Add sensitivity_level column to creator_boundaries if not present
-- Using creator_boundaries since it already holds per-creator settings
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'creator_boundaries' AND column_name = 'sensitivity_level'
  ) THEN
    ALTER TABLE creator_boundaries
      ADD COLUMN sensitivity_level VARCHAR(20) NOT NULL DEFAULT 'normal'
      CHECK (sensitivity_level IN ('relaxed', 'normal', 'sensitive'));
  END IF;
END $$;
