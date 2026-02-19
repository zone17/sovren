-- Migration: 20260220300100_fix_review_264_atomicity_rpc.sql
-- #264 (P1): Atomic multi-table writes via Supabase RPC functions
-- #305: Fix column name mismatch (revenue_share_bps -> revenue_split_bps)
-- #306: Fix type mismatch (p_content_id TEXT -> UUID)
-- #307: SECURITY DEFINER hardening (SET search_path, REVOKE/GRANT, auth check)

-- ============================================================================
-- RPC: create_circle_atomic — creates circle + admin member in one transaction
-- Hardened: SET search_path = '' prevents search_path injection
-- ============================================================================
CREATE OR REPLACE FUNCTION create_circle_atomic(
  p_name TEXT,
  p_description TEXT,
  p_niche TEXT,
  p_max_members INT,
  p_created_by UUID
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' AS $$
DECLARE
  v_circle_id UUID;
BEGIN
  -- #307: Verify caller is creating circle for themselves
  IF p_created_by != auth.uid() THEN
    RAISE EXCEPTION 'Cannot create circle for another user';
  END IF;

  INSERT INTO public.creator_circles (name, description, niche, max_members, created_by)
  VALUES (p_name, p_description, p_niche, p_max_members, p_created_by)
  RETURNING id INTO v_circle_id;

  INSERT INTO public.circle_members (circle_id, creator_id, role, joined_at)
  VALUES (v_circle_id, p_created_by, 'admin', now());

  RETURN v_circle_id;
END;
$$;

-- #307: Harden — only authenticated users can call this function
REVOKE ALL ON FUNCTION create_circle_atomic(TEXT, TEXT, TEXT, INT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_circle_atomic(TEXT, TEXT, TEXT, INT, UUID) TO authenticated;

-- ============================================================================
-- RPC: update_revenue_split_atomic — updates all splits in one transaction
-- #305: Fixed column name: revenue_split_bps (not revenue_share_bps)
-- #306: Fixed type: p_content_id UUID (not TEXT)
-- Hardened: SET search_path = '' prevents search_path injection
-- ============================================================================
CREATE OR REPLACE FUNCTION update_revenue_split_atomic(
  p_content_id UUID,
  p_splits JSONB -- Array of {creator_id, bps}
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' AS $$
BEGIN
  -- Delete existing splits for this content
  DELETE FROM public.content_collaborators WHERE content_id = p_content_id;

  -- Insert new splits (#305: correct column name is revenue_split_bps)
  INSERT INTO public.content_collaborators (content_id, creator_id, revenue_split_bps, status)
  SELECT
    p_content_id,
    (s->>'creator_id')::UUID,
    (s->>'bps')::INT,
    'accepted'
  FROM jsonb_array_elements(p_splits) AS s;
END;
$$;

-- #307: Harden — only authenticated users can call this function
REVOKE ALL ON FUNCTION update_revenue_split_atomic(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_revenue_split_atomic(UUID, JSONB) TO authenticated;

-- ============================================================================
-- RPC: record_revenue_split_ledger_atomic — ledger + payments in one transaction
-- #306: Fixed type: p_content_id UUID (not TEXT)
-- Hardened: SET search_path = '' prevents search_path injection
-- ============================================================================
CREATE OR REPLACE FUNCTION record_revenue_split_ledger_atomic(
  p_content_id UUID,
  p_total_sats BIGINT,
  p_initiated_by UUID,
  p_payments JSONB -- Array of {creator_id, amount_sats}
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' AS $$
DECLARE
  v_ledger_id UUID;
BEGIN
  INSERT INTO public.revenue_split_ledger (content_id, total_sats, initiated_by)
  VALUES (p_content_id, p_total_sats, p_initiated_by)
  RETURNING id INTO v_ledger_id;

  INSERT INTO public.revenue_split_payments (ledger_id, creator_id, amount_sats, status)
  SELECT
    v_ledger_id,
    (p->>'creator_id')::UUID,
    (p->>'amount_sats')::BIGINT,
    'pending'
  FROM jsonb_array_elements(p_payments) AS p;

  RETURN v_ledger_id;
END;
$$;

-- #307: Harden — only authenticated users can call this function
REVOKE ALL ON FUNCTION record_revenue_split_ledger_atomic(UUID, BIGINT, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_revenue_split_ledger_atomic(UUID, BIGINT, UUID, JSONB) TO authenticated;
