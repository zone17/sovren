-- #614 + #630: Add Row Level Security to provenance_records table
-- Defense-in-depth: backend uses service_role (bypasses RLS),
-- but this protects against any future authenticated-role access.
--
-- #630: Uses nostr_pubkey subquery (not auth.uid()::text) because
-- creator_id stores the NOSTR public key, not the Supabase user UUID.

ALTER TABLE provenance_records ENABLE ROW LEVEL SECURITY;

-- Creators can only read their own provenance records
CREATE POLICY provenance_records_creator_read
  ON provenance_records
  FOR SELECT
  TO authenticated
  USING (
    creator_id = (SELECT nostr_pubkey FROM users WHERE id = auth.uid())
  );

-- Creators can insert their own provenance records
CREATE POLICY provenance_records_creator_insert
  ON provenance_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    creator_id = (SELECT nostr_pubkey FROM users WHERE id = auth.uid())
  );

-- Creators can update only their own provenance records (status column only — enforced by trigger)
CREATE POLICY provenance_records_creator_update
  ON provenance_records
  FOR UPDATE
  TO authenticated
  USING (
    creator_id = (SELECT nostr_pubkey FROM users WHERE id = auth.uid())
  );

-- Service role retains full access for backend operations
CREATE POLICY provenance_records_service_all
  ON provenance_records
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
