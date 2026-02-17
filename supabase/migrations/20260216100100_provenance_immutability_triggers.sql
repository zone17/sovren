-- Todo 162: Provenance record immutability via DB triggers
-- Blocks UPDATE/DELETE on provenance_records for ALL roles including service-role
-- Allows UPDATE only on the 'status' column for soft-revocation

-- Add status column for soft-revocation if not present
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'provenance_records' AND column_name = 'status'
  ) THEN
    ALTER TABLE provenance_records
      ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active'
      CHECK (status IN ('active', 'revoked'));
  END IF;
END $$;

-- Create the immutability enforcement function
CREATE OR REPLACE FUNCTION prevent_provenance_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- For UPDATE: only allow changes to the 'status' column
  IF TG_OP = 'UPDATE' THEN
    -- Check if only the status column changed
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NEW.content_id = OLD.content_id
       AND NEW.creator_id = OLD.creator_id
       AND NEW.signature = OLD.signature
       AND NEW.nostr_event_id = OLD.nostr_event_id
       AND NEW.content_hash = OLD.content_hash
       AND NEW.created_at = OLD.created_at
    THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Provenance records are immutable. Only status column can be updated for revocation.';
  END IF;

  -- DELETE is always blocked
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Provenance records are immutable. DELETE is blocked for all roles including service-role.';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if present, then create
DROP TRIGGER IF EXISTS enforce_provenance_immutability ON provenance_records;

CREATE TRIGGER enforce_provenance_immutability
  BEFORE UPDATE OR DELETE ON provenance_records
  FOR EACH ROW EXECUTE FUNCTION prevent_provenance_modification();
