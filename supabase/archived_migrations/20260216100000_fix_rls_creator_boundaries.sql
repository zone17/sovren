-- Todo 156: Fix RLS policy on creator_boundaries
-- Changes SELECT USING (TRUE) to SELECT USING (creator_id = auth.uid())
-- Ensures all CRUD operations are restricted to the row owner

-- Enable RLS if not already enabled
ALTER TABLE IF EXISTS creator_boundaries ENABLE ROW LEVEL SECURITY;

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Users can read all boundaries" ON creator_boundaries;
DROP POLICY IF EXISTS "creator_boundaries_select" ON creator_boundaries;
DROP POLICY IF EXISTS "creator_boundaries_insert" ON creator_boundaries;
DROP POLICY IF EXISTS "creator_boundaries_update" ON creator_boundaries;
DROP POLICY IF EXISTS "creator_boundaries_delete" ON creator_boundaries;

-- SELECT: creators can only read their own boundaries
CREATE POLICY "creator_boundaries_select"
  ON creator_boundaries FOR SELECT
  USING (creator_id = auth.uid());

-- INSERT: creators can only insert their own boundaries
CREATE POLICY "creator_boundaries_insert"
  ON creator_boundaries FOR INSERT
  WITH CHECK (creator_id = auth.uid());

-- UPDATE: creators can only update their own boundaries
CREATE POLICY "creator_boundaries_update"
  ON creator_boundaries FOR UPDATE
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

-- DELETE: creators can only delete their own boundaries
CREATE POLICY "creator_boundaries_delete"
  ON creator_boundaries FOR DELETE
  USING (creator_id = auth.uid());
