-- Todo 154: Create RPC function for anonymous wellness benchmarks
-- Replaces full table scan with aggregate query + anonymity threshold

CREATE OR REPLACE FUNCTION get_wellness_benchmark()
RETURNS TABLE(
  avg_score numeric,
  stddev_score numeric,
  p25_score numeric,
  p50_score numeric,
  p75_score numeric,
  sample_count bigint
) AS $$
DECLARE
  creator_count bigint;
BEGIN
  SELECT COUNT(DISTINCT creator_id) INTO creator_count FROM wellness_snapshots;

  -- Anonymity threshold: do not return benchmarks if fewer than 5 creators
  IF creator_count < 5 THEN
    RETURN QUERY SELECT
      NULL::numeric,
      NULL::numeric,
      NULL::numeric,
      NULL::numeric,
      NULL::numeric,
      0::bigint;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    AVG(composite_score)::numeric,
    STDDEV(composite_score)::numeric,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY composite_score)::numeric,
    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY composite_score)::numeric,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY composite_score)::numeric,
    COUNT(*)::bigint
  FROM wellness_snapshots;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
