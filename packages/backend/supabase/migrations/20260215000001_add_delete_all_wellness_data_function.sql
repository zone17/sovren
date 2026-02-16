-- Migration: Add atomic delete_all_wellness_data function
-- Fixes P1 Todo 148: deleteAllWellnessData not atomic (GDPR partial deletion risk)
--
-- All 4 wellness table deletes now execute in a single transaction.
-- If any DELETE fails, the entire operation rolls back — no partial state.

CREATE OR REPLACE FUNCTION delete_all_wellness_data(p_creator_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wellness_snapshots_count INT;
  v_creator_work_patterns_count INT;
  v_burnout_risk_history_count INT;
  v_creator_boundaries_count INT;
BEGIN
  -- All statements within a PL/pgSQL function body execute inside a single
  -- transaction. If any DELETE raises an exception, the entire function
  -- (and therefore all DELETEs) is rolled back automatically.

  DELETE FROM wellness_snapshots
    WHERE creator_id = p_creator_id;
  GET DIAGNOSTICS v_wellness_snapshots_count = ROW_COUNT;

  DELETE FROM creator_work_patterns
    WHERE creator_id = p_creator_id;
  GET DIAGNOSTICS v_creator_work_patterns_count = ROW_COUNT;

  DELETE FROM burnout_risk_history
    WHERE creator_id = p_creator_id;
  GET DIAGNOSTICS v_burnout_risk_history_count = ROW_COUNT;

  DELETE FROM creator_boundaries
    WHERE creator_id = p_creator_id;
  GET DIAGNOSTICS v_creator_boundaries_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'wellness_snapshots', v_wellness_snapshots_count,
    'creator_work_patterns', v_creator_work_patterns_count,
    'burnout_risk_history', v_burnout_risk_history_count,
    'creator_boundaries', v_creator_boundaries_count
  );
END;
$$;

-- Restrict execution to authenticated users only
REVOKE ALL ON FUNCTION delete_all_wellness_data(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_all_wellness_data(UUID) TO authenticated;

COMMENT ON FUNCTION delete_all_wellness_data IS
  'Atomically deletes all wellness data for a creator (GDPR right to erasure). '
  'Wraps deletes from wellness_snapshots, creator_work_patterns, burnout_risk_history, '
  'and creator_boundaries in a single transaction. Returns per-table deletion counts.';
