-- P1-DB-004 + P1-DB-005: SECURITY DEFINER auth check + financial CHECK constraints
--
-- P1-DB-004: Fix delete_all_wellness_data — add auth.uid() ownership check.
--   File: supabase/migrations/20260215000001_add_delete_all_wellness_data_function.sql
--   Issue: Any authenticated user could delete ANY creator's wellness data
--          because the function runs as DB owner (SECURITY DEFINER) and the
--          only parameter is p_creator_id (no ownership verification).
--   Fix:   Reject calls where the calling user's UUID != p_creator_id,
--          unless the caller is service_role (for admin/GDPR deletion workflows).
--
-- P1-DB-005: Add CHECK constraints to financial columns missing them.
--   Tables: service_orders (amount_sats), lightning_payments (amount_sats, fee_sats),
--           lightning_invoices (amount_sats), lightning_analytics (amount_sats nullable),
--           transactions (amount_sats, fee_sats)
--   NOT re-constraining tables that already have CHECK (amount > 0) from baseline.

-- =============================================================================
-- P1-DB-004: Fix delete_all_wellness_data with ownership check
-- =============================================================================
CREATE OR REPLACE FUNCTION delete_all_wellness_data(p_creator_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wellness_snapshots_count   INT;
  v_creator_work_patterns_count INT;
  v_burnout_risk_history_count  INT;
  v_creator_boundaries_count    INT;
BEGIN
  -- AUTHORIZATION CHECK (P1-DB-004 fix):
  -- Only allow the data owner or service_role to delete wellness data.
  -- service_role is used by admin/GDPR workflows that run outside user context.
  IF auth.uid() IS DISTINCT FROM p_creator_id AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Not authorized: only the data owner can delete their wellness data'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- All statements execute inside a single transaction (PL/pgSQL guarantee).
  -- If any DELETE raises an exception, all DELETEs are rolled back.

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
    'wellness_snapshots',       v_wellness_snapshots_count,
    'creator_work_patterns',    v_creator_work_patterns_count,
    'burnout_risk_history',     v_burnout_risk_history_count,
    'creator_boundaries',       v_creator_boundaries_count
  );
END;
$$;

REVOKE ALL ON FUNCTION delete_all_wellness_data(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_all_wellness_data(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_all_wellness_data(UUID) TO service_role;

COMMENT ON FUNCTION delete_all_wellness_data IS
  'Atomically deletes all wellness data for a creator (GDPR right to erasure). '
  'Caller must be the data owner (auth.uid() = p_creator_id) or service_role. '
  'Wraps deletes from wellness_snapshots, creator_work_patterns, burnout_risk_history, '
  'and creator_boundaries in a single transaction. Returns per-table deletion counts.';

-- =============================================================================
-- P1-DB-005: Add CHECK constraints to financial columns
-- =============================================================================

-- service_orders.amount_sats: escrow amounts must be positive
ALTER TABLE service_orders
  ADD CONSTRAINT service_orders_amount_sats_positive
    CHECK (amount_sats > 0);

-- lightning_payments.amount_sats: payment amounts must be positive
ALTER TABLE lightning_payments
  ADD CONSTRAINT lightning_payments_amount_sats_positive
    CHECK (amount_sats > 0);

-- lightning_payments.fee_sats: fees must be non-negative
ALTER TABLE lightning_payments
  ADD CONSTRAINT lightning_payments_fee_sats_nonnegative
    CHECK (fee_sats >= 0);

-- lightning_invoices.amount_sats: nullable, but if set must be positive
ALTER TABLE lightning_invoices
  ADD CONSTRAINT lightning_invoices_amount_sats_positive
    CHECK (amount_sats IS NULL OR amount_sats > 0);

-- transactions.amount_sats: transaction amounts must be positive
ALTER TABLE transactions
  ADD CONSTRAINT transactions_amount_sats_positive
    CHECK (amount_sats > 0);

-- transactions.fee_sats: fees must be non-negative
ALTER TABLE transactions
  ADD CONSTRAINT transactions_fee_sats_nonnegative
    CHECK (fee_sats >= 0);

-- payouts.fee_sats: payout fees must be non-negative
ALTER TABLE payouts
  ADD CONSTRAINT payouts_fee_sats_nonnegative
    CHECK (fee_sats >= 0);

-- payout_schedules.min_amount_sats: minimum payout threshold must be positive
ALTER TABLE payout_schedules
  ADD CONSTRAINT payout_schedules_min_amount_sats_positive
    CHECK (min_amount_sats > 0);
