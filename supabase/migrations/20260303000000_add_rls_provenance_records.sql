-- #614: Add Row Level Security to provenance_records table
-- Defense-in-depth: backend uses service_role (bypasses RLS),
-- but this protects against any future authenticated-role access.

ALTER TABLE provenance_records ENABLE ROW LEVEL SECURITY;

-- Creators can only read their own provenance records
CREATE POLICY provenance_records_creator_read
  ON provenance_records
  FOR SELECT
  TO authenticated
  USING (creator_id = auth.uid()::text);

-- Service role retains full access for backend operations
CREATE POLICY provenance_records_service_all
  ON provenance_records
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
