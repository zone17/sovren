-- Migration: Add payment state transition atomic function
-- Story #002: Implement Payment State Machine Service
-- Date: 2025-10-23
-- Description: Creates PostgreSQL function for atomic payment state transitions
--              with validation, audit trail creation, and transaction safety.

-- Drop function if exists (for re-runability)
DROP FUNCTION IF EXISTS transition_payment_state(UUID, VARCHAR, VARCHAR, JSONB, UUID);

/**
 * Atomic Payment State Transition Function
 *
 * Performs payment state transition with the following guarantees:
 * 1. Atomicity: State update and event creation happen together or not at all
 * 2. Validation: Verifies current state matches expected from_state
 * 3. Audit Trail: Creates immutable payment event record
 * 4. Row Locking: Prevents concurrent modifications
 *
 * @param p_payment_id UUID - Payment to transition
 * @param p_from_state VARCHAR(20) - Expected current state (for optimistic locking)
 * @param p_to_state VARCHAR(20) - Target state
 * @param p_metadata JSONB - Optional transition metadata
 * @param p_user_id UUID - Optional user who initiated transition
 * @returns TABLE(event_id UUID, success BOOLEAN, error_message TEXT)
 */
CREATE OR REPLACE FUNCTION transition_payment_state(
  p_payment_id UUID,
  p_from_state VARCHAR(20),
  p_to_state VARCHAR(20),
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE(
  event_id UUID,
  success BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  v_event_id UUID;
  v_current_state VARCHAR(20);
  v_payment_exists BOOLEAN;
BEGIN
  -- Step 1: Lock payment row for update (prevents concurrent modifications)
  SELECT state, TRUE
  INTO v_current_state, v_payment_exists
  FROM payments
  WHERE id = p_payment_id
  FOR UPDATE;

  -- Step 2: Verify payment exists
  IF NOT v_payment_exists THEN
    RETURN QUERY SELECT
      NULL::UUID,
      FALSE,
      'Payment not found: ' || p_payment_id::text;
    RETURN;
  END IF;

  -- Step 3: Verify current state matches expected from_state (optimistic locking)
  IF v_current_state != p_from_state THEN
    RETURN QUERY SELECT
      NULL::UUID,
      FALSE,
      'Payment state mismatch. Expected: ' || p_from_state || ', Actual: ' || v_current_state;
    RETURN;
  END IF;

  -- Step 4: Update payment state
  UPDATE payments
  SET
    state = p_to_state,
    updated_at = NOW()
  WHERE id = p_payment_id;

  -- Step 5: Create audit event (automatically via trigger)
  -- Note: The payment_state_change trigger will create the event
  -- We retrieve the event ID after trigger execution

  -- Wait for trigger to complete and get event ID
  SELECT id
  INTO v_event_id
  FROM payment_events
  WHERE payment_id = p_payment_id
  AND state = p_to_state
  AND previous_state = p_from_state
  ORDER BY timestamp DESC
  LIMIT 1;

  -- If no event was created by trigger, create one manually
  IF v_event_id IS NULL THEN
    INSERT INTO payment_events (
      payment_id,
      state,
      previous_state,
      timestamp,
      metadata,
      user_id
    ) VALUES (
      p_payment_id,
      p_to_state,
      p_from_state,
      NOW(),
      p_metadata,
      p_user_id
    )
    RETURNING id INTO v_event_id;
  ELSE
    -- Update metadata and user_id if event was created by trigger
    UPDATE payment_events
    SET
      metadata = p_metadata,
      user_id = p_user_id
    WHERE id = v_event_id;
  END IF;

  -- Step 6: Return success
  RETURN QUERY SELECT
    v_event_id,
    TRUE,
    NULL::TEXT;

EXCEPTION
  WHEN OTHERS THEN
    -- Catch any unexpected errors and return failure
    RETURN QUERY SELECT
      NULL::UUID,
      FALSE,
      'Transaction failed: ' || SQLERRM;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER; -- Run with function owner's privileges

-- Add comment to function
COMMENT ON FUNCTION transition_payment_state(UUID, VARCHAR, VARCHAR, JSONB, UUID) IS
  'Atomically transition payment state with validation and audit trail creation. '
  'Used by PaymentStateMachine service for guaranteed consistency.';

-- Grant execute permission to authenticated users
-- Note: In production, restrict this to service role only
GRANT EXECUTE ON FUNCTION transition_payment_state(UUID, VARCHAR, VARCHAR, JSONB, UUID) TO authenticated;

-- Create index on payment_events for efficient event lookup
CREATE INDEX IF NOT EXISTS idx_payment_events_payment_state_prev
  ON payment_events(payment_id, state, previous_state, timestamp DESC);

-- Create function to validate state transitions (used by application)
CREATE OR REPLACE FUNCTION is_transition_allowed(
  p_from_state VARCHAR(20),
  p_to_state VARCHAR(20)
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Define allowed transitions
  -- This mirrors the ALLOWED_TRANSITIONS map in TypeScript
  RETURN (
    (p_from_state = 'pending' AND p_to_state IN ('processing', 'expired', 'failed')) OR
    (p_from_state = 'processing' AND p_to_state IN ('completed', 'failed')) OR
    (p_from_state = 'completed' AND p_to_state = 'refunded') OR
    (p_from_state = 'failed' AND p_to_state = 'pending') OR
    FALSE -- Terminal states (expired, refunded) cannot transition
  );
END;
$$ LANGUAGE plpgsql
IMMUTABLE; -- Function result depends only on inputs, can be cached

COMMENT ON FUNCTION is_transition_allowed(VARCHAR, VARCHAR) IS
  'Validates if a payment state transition is allowed according to state machine rules.';

GRANT EXECUTE ON FUNCTION is_transition_allowed(VARCHAR, VARCHAR) TO authenticated;

-- Create check constraint to enforce valid state transitions
-- Note: This is a safety net; validation should happen in application layer first
ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_valid_state_transition;

-- We can't add a check constraint for state transitions directly on the table
-- because it would require knowing the previous state. Instead, we rely on:
-- 1. Application-level validation (PaymentStateMachine service)
-- 2. Database function validation (transition_payment_state)
-- 3. Audit trail for forensics (payment_events table)

-- Create function to get payment state history summary
CREATE OR REPLACE FUNCTION get_payment_state_summary(p_payment_id UUID)
RETURNS TABLE(
  current_state VARCHAR(20),
  total_transitions INTEGER,
  created_at TIMESTAMPTZ,
  last_updated TIMESTAMPTZ,
  time_in_current_state INTERVAL,
  transition_count_by_state JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.state AS current_state,
    COUNT(pe.id)::INTEGER AS total_transitions,
    p.created_at,
    p.updated_at AS last_updated,
    (NOW() - p.updated_at) AS time_in_current_state,
    jsonb_object_agg(pe.state, COUNT(*)) AS transition_count_by_state
  FROM payments p
  LEFT JOIN payment_events pe ON pe.payment_id = p.id
  WHERE p.id = p_payment_id
  GROUP BY p.id, p.state, p.created_at, p.updated_at;
END;
$$ LANGUAGE plpgsql
STABLE
SECURITY DEFINER;

COMMENT ON FUNCTION get_payment_state_summary(UUID) IS
  'Get summary statistics for a payment state history.';

GRANT EXECUTE ON FUNCTION get_payment_state_summary(UUID) TO authenticated;

-- Create view for payment state analytics
CREATE OR REPLACE VIEW payment_state_analytics AS
SELECT
  p.state,
  COUNT(*) AS payment_count,
  AVG(EXTRACT(EPOCH FROM (NOW() - p.created_at))) AS avg_age_seconds,
  COUNT(CASE WHEN p.created_at > NOW() - INTERVAL '1 hour' THEN 1 END) AS count_last_hour,
  COUNT(CASE WHEN p.created_at > NOW() - INTERVAL '1 day' THEN 1 END) AS count_last_day,
  COUNT(CASE WHEN p.created_at > NOW() - INTERVAL '1 week' THEN 1 END) AS count_last_week
FROM payments p
GROUP BY p.state;

COMMENT ON VIEW payment_state_analytics IS
  'Real-time analytics of payment states for monitoring dashboards.';

-- Grant select permission on view
GRANT SELECT ON payment_state_analytics TO authenticated;

-- Create function to expire old pending payments
CREATE OR REPLACE FUNCTION expire_old_pending_payments(
  p_expiration_seconds INTEGER DEFAULT 3600
)
RETURNS TABLE(
  expired_payment_id UUID,
  previous_state VARCHAR(20)
) AS $$
BEGIN
  -- This function will be used by a background job (Story #003)
  -- For now, just define the structure
  RETURN QUERY
  SELECT
    p.id AS expired_payment_id,
    p.state AS previous_state
  FROM payments p
  WHERE
    p.state = 'pending'
    AND (p.expires_at IS NOT NULL AND p.expires_at < NOW())
    OR (p.expires_at IS NULL AND p.created_at < NOW() - (p_expiration_seconds || ' seconds')::INTERVAL);
END;
$$ LANGUAGE plpgsql
STABLE
SECURITY DEFINER;

COMMENT ON FUNCTION expire_old_pending_payments(INTEGER) IS
  'Find pending payments that should be expired. Used by background job scheduler.';

-- Grant execute permission (restricted to service role in production)
GRANT EXECUTE ON FUNCTION expire_old_pending_payments(INTEGER) TO authenticated;
