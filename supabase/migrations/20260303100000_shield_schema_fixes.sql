-- Content Shield schema fixes from R2 review findings
-- #622: Add missing columns (verification_status, relay_confirmations)
-- #623: Add UNIQUE constraint on content_id
-- #624: Change creator_id from UUID to TEXT (stores nostr pubkey, not user UUID)
-- #626: Add immutability trigger (only status column is updatable)
-- #631: Add creator_id to content_alerts, enable RLS

-- ============================================================================
-- #622: Add missing columns to provenance_records
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'provenance_records' AND column_name = 'verification_status'
  ) THEN
    ALTER TABLE provenance_records
      ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'unverified'
      CHECK (verification_status IN ('verified', 'unverified', 'disputed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'provenance_records' AND column_name = 'relay_confirmations'
  ) THEN
    ALTER TABLE provenance_records
      ADD COLUMN relay_confirmations JSONB NOT NULL DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'provenance_records' AND column_name = 'status'
  ) THEN
    ALTER TABLE provenance_records
      ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
      CHECK (status IN ('active', 'revoked'));
  END IF;
END $$;

-- ============================================================================
-- #623: UNIQUE constraint on content_id (one active provenance per content)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'provenance_records_content_id_key'
  ) THEN
    ALTER TABLE provenance_records
      ADD CONSTRAINT provenance_records_content_id_key UNIQUE (content_id);
  END IF;
END $$;

-- ============================================================================
-- #624: Change creator_id from UUID to TEXT
-- ============================================================================

DO $$
DECLARE
  col_type TEXT;
BEGIN
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_name = 'provenance_records' AND column_name = 'creator_id';

  IF col_type = 'uuid' THEN
    -- Drop foreign key constraint if it exists
    ALTER TABLE provenance_records
      DROP CONSTRAINT IF EXISTS provenance_records_creator_id_fkey;
    -- Change column type
    ALTER TABLE provenance_records
      ALTER COLUMN creator_id TYPE TEXT USING creator_id::text;
  END IF;
END $$;

-- ============================================================================
-- #614: Authenticated user policies for provenance_records
-- (Created here AFTER #624 changes creator_id from UUID to TEXT)
-- ============================================================================

DROP POLICY IF EXISTS provenance_records_creator_read ON provenance_records;
DROP POLICY IF EXISTS provenance_records_creator_insert ON provenance_records;
DROP POLICY IF EXISTS provenance_records_creator_update ON provenance_records;

CREATE POLICY provenance_records_creator_read
  ON provenance_records
  FOR SELECT
  TO authenticated
  USING (
    creator_id = (SELECT nostr_pubkey FROM users WHERE id = auth.uid())
  );

CREATE POLICY provenance_records_creator_insert
  ON provenance_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    creator_id = (SELECT nostr_pubkey FROM users WHERE id = auth.uid())
  );

CREATE POLICY provenance_records_creator_update
  ON provenance_records
  FOR UPDATE
  TO authenticated
  USING (
    creator_id = (SELECT nostr_pubkey FROM users WHERE id = auth.uid())
  );

-- ============================================================================
-- #626: Immutability trigger — only status column can be updated
-- ============================================================================

CREATE OR REPLACE FUNCTION enforce_provenance_immutability()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow status changes (for revocation)
  IF OLD.content_id IS DISTINCT FROM NEW.content_id
     OR OLD.creator_id IS DISTINCT FROM NEW.creator_id
     OR OLD.signature IS DISTINCT FROM NEW.signature
     OR OLD.nostr_event_id IS DISTINCT FROM NEW.nostr_event_id
     OR OLD.content_hash IS DISTINCT FROM NEW.content_hash
  THEN
    RAISE EXCEPTION 'Provenance records are immutable. Only status can be updated.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_provenance_immutability ON provenance_records;
CREATE TRIGGER trg_enforce_provenance_immutability
  BEFORE UPDATE ON provenance_records
  FOR EACH ROW
  EXECUTE FUNCTION enforce_provenance_immutability();

-- ============================================================================
-- #631: Add creator_id to content_alerts + RLS
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'content_alerts' AND column_name = 'creator_id'
  ) THEN
    ALTER TABLE content_alerts
      ADD COLUMN creator_id TEXT;
  END IF;
END $$;

ALTER TABLE content_alerts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS content_alerts_creator_read ON content_alerts;
DROP POLICY IF EXISTS content_alerts_creator_update ON content_alerts;
DROP POLICY IF EXISTS content_alerts_service_all ON content_alerts;

CREATE POLICY content_alerts_creator_read
  ON content_alerts
  FOR SELECT
  TO authenticated
  USING (
    creator_id = (SELECT nostr_pubkey FROM users WHERE id = auth.uid())
  );

CREATE POLICY content_alerts_creator_update
  ON content_alerts
  FOR UPDATE
  TO authenticated
  USING (
    creator_id = (SELECT nostr_pubkey FROM users WHERE id = auth.uid())
  );

CREATE POLICY content_alerts_service_all
  ON content_alerts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
