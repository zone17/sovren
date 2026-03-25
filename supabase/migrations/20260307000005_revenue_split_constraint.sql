-- Revenue split sum constraint: ensures total revenue_split_bps per content_id
-- never exceeds 10000 (100%). Uses SECURITY DEFINER to bypass RLS for validation.

CREATE OR REPLACE FUNCTION validate_revenue_split_sum()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public AS $$
DECLARE
  total_bps INTEGER;
BEGIN
  SELECT COALESCE(SUM(revenue_split_bps), 0) INTO total_bps
  FROM content_collaborators
  WHERE content_id = NEW.content_id AND id != NEW.id;

  IF (total_bps + NEW.revenue_split_bps) > 10000 THEN
    RAISE EXCEPTION 'Revenue split total exceeds 100%% (10000 bps). Current: %, Adding: %', total_bps, NEW.revenue_split_bps;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_revenue_split
  BEFORE INSERT OR UPDATE OF revenue_split_bps ON content_collaborators
  FOR EACH ROW EXECUTE FUNCTION validate_revenue_split_sum();
