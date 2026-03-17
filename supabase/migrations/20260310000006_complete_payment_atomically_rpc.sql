-- P1-DB-003 (addendum): complete_payment_atomically RPC + premium_content_access schema fix
--
-- 1. complete_payment_atomically — called by webhooks.ts on 'payment.completed' events.
--    Atomically writes preimage to payments.preimage + transitions state to 'completed'
--    + inserts a payment_events audit row — all in one transaction.
--    Returns JSONB { success BOOL, error_message TEXT }.
--    This prevents the crash-between-operations bug (P1-PAY-003) where payment proof
--    (preimage) could be lost if the process dies between the two DB writes.
--
-- 2. premium_content_access schema fix — webhooks.ts inserts price_paid, purchased_at,
--    is_active columns that don't exist in the baseline schema. Add them here.
--
-- Signature matches webhooks.ts call:
--   supabase.rpc('complete_payment_atomically', {
--     p_payment_id: UUID,
--     p_from_state: VARCHAR(20),
--     p_preimage:   VARCHAR(64),
--     p_metadata:   JSONB,
--     p_user_id:    UUID | null,
--   })

-- =============================================================================
-- 1. Add missing columns to premium_content_access
--    (webhooks.ts inserts price_paid, purchased_at, is_active)
-- =============================================================================
ALTER TABLE premium_content_access
  ADD COLUMN IF NOT EXISTS price_paid     BIGINT,
  ADD COLUMN IF NOT EXISTS purchased_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_active      BOOLEAN NOT NULL DEFAULT true;

-- Add CHECK so price_paid can't be negative when set
ALTER TABLE premium_content_access
  ADD CONSTRAINT premium_content_access_price_paid_nonnegative
    CHECK (price_paid IS NULL OR price_paid >= 0);

-- =============================================================================
-- 2. complete_payment_atomically
--    Atomically:
--      a) Lock the payment row (FOR UPDATE)
--      b) Validate expected from_state
--      c) Write preimage + set status='paid' + set paid_at + set state='completed'
--      d) Insert payment_events audit row
--    Returns JSONB: { success: bool, error_message: text }
--    Callers should check result.success and handle result.error_message on false.
-- =============================================================================
CREATE OR REPLACE FUNCTION complete_payment_atomically(
  p_payment_id UUID,
  p_from_state VARCHAR(20),
  p_preimage   VARCHAR(64),
  p_metadata   JSONB DEFAULT '{}',
  p_user_id    UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_state VARCHAR(20);
  v_event_id      UUID;
BEGIN
  -- Step 1: Lock the payment row to prevent concurrent completions
  SELECT state INTO v_current_state
  FROM payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success',       false,
      'error_message', format('Payment %s not found', p_payment_id)
    );
  END IF;

  -- Step 2: Validate the expected from_state matches actual state
  IF v_current_state != p_from_state THEN
    RETURN jsonb_build_object(
      'success',       false,
      'error_message', format(
        'State mismatch: expected %s, got %s',
        p_from_state, v_current_state
      )
    );
  END IF;

  -- Step 3: Write preimage + transition state atomically
  UPDATE payments
  SET
    preimage   = p_preimage,
    state      = 'completed',
    status     = 'paid',
    paid_at    = NOW(),
    updated_at = NOW()
  WHERE id = p_payment_id;

  -- Step 4: Insert audit event row
  INSERT INTO payment_events (
    id,
    payment_id,
    state,
    previous_state,
    event_timestamp,
    metadata,
    triggered_by
  ) VALUES (
    gen_random_uuid(),
    p_payment_id,
    'completed',
    p_from_state,
    NOW(),
    p_metadata,
    p_user_id
  ) RETURNING id INTO v_event_id;

  RETURN jsonb_build_object(
    'success',   true,
    'event_id',  v_event_id
  );

EXCEPTION WHEN OTHERS THEN
  -- Surface the error message to the caller without exposing internals
  RETURN jsonb_build_object(
    'success',       false,
    'error_message', SQLERRM
  );
END;
$$;

-- Webhooks run under service_role — no authenticated user context.
-- This function must NOT be callable by regular authenticated users.
REVOKE ALL ON FUNCTION complete_payment_atomically(UUID, VARCHAR, VARCHAR, JSONB, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION complete_payment_atomically(UUID, VARCHAR, VARCHAR, JSONB, UUID) TO service_role;

COMMENT ON FUNCTION complete_payment_atomically IS
  'Atomically writes preimage + transitions payment state to completed + inserts audit event. '
  'Called by webhook handler on payment.completed events (P1-PAY-003). '
  'Prevents lost payment proof if process crashes between two separate DB writes. '
  'Returns { success: bool, error_message: text }. service_role only.';
