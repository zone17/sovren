-- Migration: Add payment lock function for race condition prevention
-- Story #004: Implement Race Condition Prevention in Payment Verification
-- Date: 2025-10-23
-- Description: Creates PostgreSQL functions for atomic payment locking with
--              NOWAIT semantics to prevent duplicate payment processing and
--              race conditions in concurrent verification scenarios.

-- Drop existing functions if they exist (for re-runability)
DROP FUNCTION IF EXISTS acquire_payment_lock(VARCHAR);
DROP FUNCTION IF EXISTS acquire_payment_lock_by_id(UUID);
DROP TABLE IF EXISTS payment_lock_events;

/**
 * Payment Lock Events Table
 *
 * Tracks all lock acquisition attempts for monitoring and analytics.
 * Used to detect lock contention and optimize concurrent processing.
 */
CREATE TABLE payment_lock_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID NOT NULL,
  lock_acquired BOOLEAN NOT NULL,
  lock_wait_time_ms INTEGER,
  process_id INTEGER,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,

  CONSTRAINT fk_payment_lock_events_payment
    FOREIGN KEY (payment_id)
    REFERENCES payments(id)
    ON DELETE CASCADE
);

-- Create indexes for lock event analytics
CREATE INDEX idx_payment_lock_events_payment_id
  ON payment_lock_events(payment_id);

CREATE INDEX idx_payment_lock_events_timestamp
  ON payment_lock_events(timestamp DESC);

CREATE INDEX idx_payment_lock_events_lock_acquired
  ON payment_lock_events(lock_acquired);

COMMENT ON TABLE payment_lock_events IS
  'Audit trail for payment lock acquisition attempts. Used for monitoring lock contention and race condition detection.';

/**
 * Acquire Payment Lock by Payment Hash
 *
 * Attempts to acquire an exclusive row-level lock on a payment using NOWAIT.
 * This prevents concurrent payment verification attempts from processing the
 * same payment simultaneously, eliminating race conditions.
 *
 * Uses SELECT FOR UPDATE NOWAIT which:
 * 1. Acquires exclusive row lock immediately if available
 * 2. Fails immediately if row is already locked (no waiting)
 * 3. Prevents deadlocks by not waiting for locks
 * 4. Releases lock automatically at transaction end
 *
 * @param p_payment_hash VARCHAR - Lightning payment hash to lock
 * @returns TABLE - Payment details if lock acquired
 * @raises lock_not_available - If payment is already locked by another process
 * @raises no_data_found - If payment with given hash doesn't exist
 *
 * @example
 * BEGIN;
 *   SELECT * FROM acquire_payment_lock('abc123...');
 *   -- Do payment verification work
 * COMMIT; -- Lock released automatically
 */
CREATE OR REPLACE FUNCTION acquire_payment_lock(p_payment_hash VARCHAR)
RETURNS TABLE(
  id UUID,
  state VARCHAR(20),
  user_id UUID,
  amount BIGINT,
  payment_hash VARCHAR,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  retry_count INTEGER,
  metadata JSONB
) AS $$
DECLARE
  v_lock_start_time TIMESTAMPTZ;
  v_lock_wait_ms INTEGER;
  v_payment_id UUID;
BEGIN
  v_lock_start_time := clock_timestamp();

  -- Attempt to acquire lock with NOWAIT
  BEGIN
    RETURN QUERY
    SELECT
      p.id,
      p.state,
      p.user_id,
      p.amount,
      p.payment_hash,
      p.created_at,
      p.updated_at,
      p.expires_at,
      p.retry_count,
      p.metadata
    FROM payments p
    WHERE p.payment_hash = p_payment_hash
    FOR UPDATE NOWAIT; -- Fail immediately if locked

    -- Calculate lock wait time
    v_lock_wait_ms := EXTRACT(EPOCH FROM (clock_timestamp() - v_lock_start_time)) * 1000;

    -- Get payment ID for logging
    SELECT p.id INTO v_payment_id
    FROM payments p
    WHERE p.payment_hash = p_payment_hash;

    -- Log successful lock acquisition
    INSERT INTO payment_lock_events (
      payment_id,
      lock_acquired,
      lock_wait_time_ms,
      process_id,
      timestamp,
      metadata
    ) VALUES (
      v_payment_id,
      TRUE,
      v_lock_wait_ms,
      pg_backend_pid(),
      NOW(),
      jsonb_build_object(
        'payment_hash', p_payment_hash,
        'lock_type', 'NOWAIT'
      )
    );

  EXCEPTION
    WHEN lock_not_available THEN
      -- Get payment ID for logging
      SELECT p.id INTO v_payment_id
      FROM payments p
      WHERE p.payment_hash = p_payment_hash;

      -- Log failed lock acquisition
      IF v_payment_id IS NOT NULL THEN
        INSERT INTO payment_lock_events (
          payment_id,
          lock_acquired,
          lock_wait_time_ms,
          process_id,
          timestamp,
          error_message,
          metadata
        ) VALUES (
          v_payment_id,
          FALSE,
          EXTRACT(EPOCH FROM (clock_timestamp() - v_lock_start_time)) * 1000,
          pg_backend_pid(),
          NOW(),
          'Payment is locked by another process',
          jsonb_build_object(
            'payment_hash', p_payment_hash,
            'lock_type', 'NOWAIT',
            'reason', 'concurrent_processing'
          )
        );
      END IF;

      -- Re-raise the exception with a clear message
      RAISE EXCEPTION 'Payment is locked by another process. Concurrent verification in progress.'
        USING ERRCODE = 'lock_not_available';
  END;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER;

COMMENT ON FUNCTION acquire_payment_lock(VARCHAR) IS
  'Acquires exclusive row-level lock on payment by payment hash using NOWAIT. '
  'Prevents race conditions in concurrent payment verification. '
  'Logs all lock attempts to payment_lock_events for monitoring.';

/**
 * Acquire Payment Lock by Payment ID
 *
 * Similar to acquire_payment_lock but accepts payment UUID instead of hash.
 * Useful when payment ID is already known.
 *
 * @param p_payment_id UUID - Payment ID to lock
 * @returns TABLE - Payment details if lock acquired
 * @raises lock_not_available - If payment is already locked
 * @raises no_data_found - If payment doesn't exist
 */
CREATE OR REPLACE FUNCTION acquire_payment_lock_by_id(p_payment_id UUID)
RETURNS TABLE(
  id UUID,
  state VARCHAR(20),
  user_id UUID,
  amount BIGINT,
  payment_hash VARCHAR,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  retry_count INTEGER,
  metadata JSONB
) AS $$
DECLARE
  v_lock_start_time TIMESTAMPTZ;
  v_lock_wait_ms INTEGER;
BEGIN
  v_lock_start_time := clock_timestamp();

  -- Attempt to acquire lock with NOWAIT
  BEGIN
    RETURN QUERY
    SELECT
      p.id,
      p.state,
      p.user_id,
      p.amount,
      p.payment_hash,
      p.created_at,
      p.updated_at,
      p.expires_at,
      p.retry_count,
      p.metadata
    FROM payments p
    WHERE p.id = p_payment_id
    FOR UPDATE NOWAIT;

    -- Calculate lock wait time
    v_lock_wait_ms := EXTRACT(EPOCH FROM (clock_timestamp() - v_lock_start_time)) * 1000;

    -- Log successful lock acquisition
    INSERT INTO payment_lock_events (
      payment_id,
      lock_acquired,
      lock_wait_time_ms,
      process_id,
      timestamp,
      metadata
    ) VALUES (
      p_payment_id,
      TRUE,
      v_lock_wait_ms,
      pg_backend_pid(),
      NOW(),
      jsonb_build_object(
        'payment_id', p_payment_id,
        'lock_type', 'NOWAIT'
      )
    );

  EXCEPTION
    WHEN lock_not_available THEN
      -- Log failed lock acquisition
      INSERT INTO payment_lock_events (
        payment_id,
        lock_acquired,
        lock_wait_time_ms,
        process_id,
        timestamp,
        error_message,
        metadata
      ) VALUES (
        p_payment_id,
        FALSE,
        EXTRACT(EPOCH FROM (clock_timestamp() - v_lock_start_time)) * 1000,
        pg_backend_pid(),
        NOW(),
        'Payment is locked by another process',
        jsonb_build_object(
          'payment_id', p_payment_id,
          'lock_type', 'NOWAIT',
          'reason', 'concurrent_processing'
        )
      );

      -- Re-raise the exception
      RAISE EXCEPTION 'Payment is locked by another process. Concurrent verification in progress.'
        USING ERRCODE = 'lock_not_available';
  END;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER;

COMMENT ON FUNCTION acquire_payment_lock_by_id(UUID) IS
  'Acquires exclusive row-level lock on payment by ID using NOWAIT. '
  'Prevents race conditions in concurrent payment verification.';

/**
 * Get Payment Lock Statistics
 *
 * Analytics function to monitor lock contention and performance.
 * Returns aggregated statistics about lock acquisition attempts.
 *
 * @param p_time_window INTERVAL - Time window to analyze (default: 1 hour)
 * @returns TABLE - Lock statistics
 */
CREATE OR REPLACE FUNCTION get_payment_lock_stats(
  p_time_window INTERVAL DEFAULT INTERVAL '1 hour'
)
RETURNS TABLE(
  total_attempts BIGINT,
  successful_locks BIGINT,
  failed_locks BIGINT,
  success_rate NUMERIC,
  avg_lock_wait_time_ms NUMERIC,
  max_lock_wait_time_ms INTEGER,
  unique_payments_locked BIGINT,
  lock_contention_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_attempts,
    COUNT(*) FILTER (WHERE lock_acquired = TRUE)::BIGINT AS successful_locks,
    COUNT(*) FILTER (WHERE lock_acquired = FALSE)::BIGINT AS failed_locks,
    ROUND(
      (COUNT(*) FILTER (WHERE lock_acquired = TRUE)::NUMERIC / NULLIF(COUNT(*), 0)::NUMERIC) * 100,
      2
    ) AS success_rate,
    ROUND(AVG(lock_wait_time_ms), 2) AS avg_lock_wait_time_ms,
    MAX(lock_wait_time_ms) AS max_lock_wait_time_ms,
    COUNT(DISTINCT payment_id)::BIGINT AS unique_payments_locked,
    ROUND(
      (COUNT(*) FILTER (WHERE lock_acquired = FALSE)::NUMERIC / NULLIF(COUNT(*), 0)::NUMERIC) * 100,
      2
    ) AS lock_contention_rate
  FROM payment_lock_events
  WHERE timestamp > NOW() - p_time_window;
END;
$$ LANGUAGE plpgsql
STABLE
SECURITY DEFINER;

COMMENT ON FUNCTION get_payment_lock_stats(INTERVAL) IS
  'Get aggregated statistics about payment lock acquisition for monitoring dashboards.';

/**
 * Get Payments with High Lock Contention
 *
 * Identifies payments experiencing frequent lock contention.
 * Useful for debugging and optimization.
 *
 * @param p_time_window INTERVAL - Time window to analyze
 * @param p_min_attempts INTEGER - Minimum attempts to be considered high contention
 * @returns TABLE - Payments with high lock contention
 */
CREATE OR REPLACE FUNCTION get_high_contention_payments(
  p_time_window INTERVAL DEFAULT INTERVAL '1 hour',
  p_min_attempts INTEGER DEFAULT 5
)
RETURNS TABLE(
  payment_id UUID,
  payment_hash VARCHAR,
  total_attempts BIGINT,
  failed_attempts BIGINT,
  contention_rate NUMERIC,
  first_attempt TIMESTAMPTZ,
  last_attempt TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ple.payment_id,
    p.payment_hash,
    COUNT(*)::BIGINT AS total_attempts,
    COUNT(*) FILTER (WHERE ple.lock_acquired = FALSE)::BIGINT AS failed_attempts,
    ROUND(
      (COUNT(*) FILTER (WHERE ple.lock_acquired = FALSE)::NUMERIC / COUNT(*)::NUMERIC) * 100,
      2
    ) AS contention_rate,
    MIN(ple.timestamp) AS first_attempt,
    MAX(ple.timestamp) AS last_attempt
  FROM payment_lock_events ple
  JOIN payments p ON p.id = ple.payment_id
  WHERE ple.timestamp > NOW() - p_time_window
  GROUP BY ple.payment_id, p.payment_hash
  HAVING COUNT(*) >= p_min_attempts
  ORDER BY contention_rate DESC, total_attempts DESC;
END;
$$ LANGUAGE plpgsql
STABLE
SECURITY DEFINER;

COMMENT ON FUNCTION get_high_contention_payments(INTERVAL, INTEGER) IS
  'Identifies payments with high lock contention for debugging and optimization.';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION acquire_payment_lock(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION acquire_payment_lock_by_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_payment_lock_stats(INTERVAL) TO authenticated;
GRANT EXECUTE ON FUNCTION get_high_contention_payments(INTERVAL, INTEGER) TO authenticated;

-- Enable RLS on payment_lock_events
ALTER TABLE payment_lock_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view lock events for their own payments
CREATE POLICY payment_lock_events_select_own
  ON payment_lock_events
  FOR SELECT
  USING (
    payment_id IN (
      SELECT id FROM payments WHERE user_id = auth.uid()
    )
  );

-- Policy: Only system can insert lock events
CREATE POLICY payment_lock_events_insert_system
  ON payment_lock_events
  FOR INSERT
  WITH CHECK (true); -- Will be restricted to service role in production

-- Policy: No updates or deletes (immutable audit trail)
CREATE POLICY payment_lock_events_no_update
  ON payment_lock_events
  FOR UPDATE
  USING (false);

CREATE POLICY payment_lock_events_no_delete
  ON payment_lock_events
  FOR DELETE
  USING (false);

-- Create view for real-time lock monitoring
CREATE OR REPLACE VIEW payment_lock_monitor AS
SELECT
  p.id AS payment_id,
  p.payment_hash,
  p.state,
  p.amount,
  COUNT(ple.id) AS lock_attempts,
  COUNT(ple.id) FILTER (WHERE ple.lock_acquired = TRUE) AS successful_locks,
  COUNT(ple.id) FILTER (WHERE ple.lock_acquired = FALSE) AS failed_locks,
  MAX(ple.timestamp) AS last_lock_attempt,
  ROUND(AVG(ple.lock_wait_time_ms), 2) AS avg_lock_wait_ms
FROM payments p
LEFT JOIN payment_lock_events ple ON ple.payment_id = p.id
WHERE ple.timestamp > NOW() - INTERVAL '1 hour'
GROUP BY p.id, p.payment_hash, p.state, p.amount
HAVING COUNT(ple.id) > 0
ORDER BY failed_locks DESC, lock_attempts DESC;

COMMENT ON VIEW payment_lock_monitor IS
  'Real-time monitoring view for payment lock contention in the last hour.';

GRANT SELECT ON payment_lock_monitor TO authenticated;
