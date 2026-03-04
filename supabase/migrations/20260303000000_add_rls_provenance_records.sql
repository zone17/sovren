-- #614: Enable Row Level Security on provenance_records
-- Defense-in-depth: backend uses service_role (bypasses RLS),
-- but this protects against any future authenticated-role access.
--
-- NOTE: Authenticated user policies are created in 20260303100000_shield_schema_fixes.sql
-- AFTER #624 changes creator_id from UUID to TEXT.

ALTER TABLE provenance_records ENABLE ROW LEVEL SECURITY;

-- Service role retains full access for backend operations
CREATE POLICY provenance_records_service_all
  ON provenance_records
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
