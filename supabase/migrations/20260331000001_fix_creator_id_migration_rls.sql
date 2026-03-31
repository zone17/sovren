-- =============================================================================
-- Fix: Drop RLS policies that reference platform_connections.creator_id (TEXT)
-- before the column type migration, then recreate with UUID comparison.
--
-- Context: Migration 20260323000003 fails because RLS policies from
-- 20260307000004 depend on the TEXT creator_id column. This migration:
--   1. Drops the blocking policies
--   2. Retries the DROP COLUMN + rename that failed
--   3. Recreates policies with UUID-typed comparison
--
-- Idempotent: Uses IF EXISTS on all drops and IF NOT EXISTS on creates.
-- =============================================================================

-- Step 1: Drop RLS policies that reference the TEXT creator_id column
DROP POLICY IF EXISTS "platform_connections_service_role" ON platform_connections;
DROP POLICY IF EXISTS "platform_connections_select_own" ON platform_connections;

-- Step 2: Retry the column migration for platform_connections
-- (Other tables in 20260323000003 may have succeeded; platform_connections
-- is the one blocked by RLS. These are idempotent — IF EXISTS / IF NOT EXISTS.)

-- Drop constraints and indexes on old TEXT column (if still present)
ALTER TABLE platform_connections
  DROP CONSTRAINT IF EXISTS platform_connections_creator_id_platform_key;
DROP INDEX IF EXISTS idx_platform_connections_creator;

-- If the old TEXT creator_id column still exists, migrate it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'platform_connections'
      AND column_name = 'creator_id'
      AND data_type = 'text'
  ) THEN
    -- Add temp UUID column if not already present
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'platform_connections'
        AND column_name = 'creator_user_id'
    ) THEN
      ALTER TABLE platform_connections ADD COLUMN creator_user_id UUID;
    END IF;

    -- Always run UPDATE to catch partially-populated rows from prior failed runs
    UPDATE platform_connections pc
    SET creator_user_id = u.id
    FROM users u
    WHERE u.nostr_pubkey = pc.creator_id
      AND pc.creator_user_id IS NULL;

    -- Delete orphaned rows with no matching user (prevents NOT NULL failure)
    DELETE FROM platform_connections WHERE creator_user_id IS NULL;

    ALTER TABLE platform_connections DROP COLUMN creator_id;
    ALTER TABLE platform_connections RENAME COLUMN creator_user_id TO creator_id;
  END IF;
END $$;

-- Ensure NOT NULL, FK, unique constraint, and index exist
DO $$
BEGIN
  -- NOT NULL (skip if already set)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'platform_connections'
      AND column_name = 'creator_id'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE platform_connections ALTER COLUMN creator_id SET NOT NULL;
  END IF;

  -- FK constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'platform_connections_creator_id_fkey'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE platform_connections
      ADD CONSTRAINT platform_connections_creator_id_fkey
        FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;

  -- Unique constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'platform_connections_creator_id_platform_key'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE platform_connections
      ADD CONSTRAINT platform_connections_creator_id_platform_key
        UNIQUE (creator_id, platform);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_platform_connections_creator
  ON platform_connections(creator_id);

-- Step 3: Recreate RLS policies with UUID comparison
-- (creator_id is now UUID, auth.uid() returns UUID — no cast needed)
CREATE POLICY "platform_connections_service_role"
  ON platform_connections
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "platform_connections_select_own"
  ON platform_connections
  FOR SELECT
  USING (creator_id = auth.uid());
