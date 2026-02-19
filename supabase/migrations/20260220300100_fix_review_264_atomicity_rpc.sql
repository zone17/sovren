-- Migration: 20260220300100_fix_review_264_atomicity_rpc.sql
-- #264 (P1): Atomic multi-table writes via Supabase RPC functions

-- ============================================================================
-- RPC: create_circle_atomic — creates circle + admin member in one transaction
-- ============================================================================
CREATE OR REPLACE FUNCTION create_circle_atomic(
  p_name TEXT,
  p_description TEXT,
  p_niche TEXT,
  p_max_members INT,
  p_created_by UUID
) RETURNS UUID AS $$
DECLARE
  v_circle_id UUID;
BEGIN
  INSERT INTO creator_circles (name, description, niche, max_members, created_by)
  VALUES (p_name, p_description, p_niche, p_max_members, p_created_by)
  RETURNING id INTO v_circle_id;

  INSERT INTO circle_members (circle_id, creator_id, role, joined_at)
  VALUES (v_circle_id, p_created_by, 'admin', now());

  RETURN v_circle_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RPC: update_revenue_split_atomic — updates all splits in one transaction
-- ============================================================================
CREATE OR REPLACE FUNCTION update_revenue_split_atomic(
  p_content_id TEXT,
  p_splits JSONB -- Array of {creator_id, bps}
) RETURNS VOID AS $$
BEGIN
  -- Delete existing splits for this content
  DELETE FROM content_collaborators WHERE content_id = p_content_id;

  -- Insert new splits
  INSERT INTO content_collaborators (content_id, creator_id, revenue_share_bps, status)
  SELECT
    p_content_id,
    (s->>'creator_id')::UUID,
    (s->>'bps')::INT,
    'accepted'
  FROM jsonb_array_elements(p_splits) AS s;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RPC: record_revenue_split_ledger_atomic — ledger + payments in one transaction
-- ============================================================================
CREATE OR REPLACE FUNCTION record_revenue_split_ledger_atomic(
  p_content_id TEXT,
  p_total_sats BIGINT,
  p_initiated_by UUID,
  p_payments JSONB -- Array of {creator_id, amount_sats}
) RETURNS UUID AS $$
DECLARE
  v_ledger_id UUID;
BEGIN
  INSERT INTO revenue_split_ledger (content_id, total_sats, initiated_by)
  VALUES (p_content_id, p_total_sats, p_initiated_by)
  RETURNING id INTO v_ledger_id;

  INSERT INTO revenue_split_payments (ledger_id, creator_id, amount_sats, status)
  SELECT
    v_ledger_id,
    (p->>'creator_id')::UUID,
    (p->>'amount_sats')::BIGINT,
    'pending'
  FROM jsonb_array_elements(p_payments) AS p;

  RETURN v_ledger_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
