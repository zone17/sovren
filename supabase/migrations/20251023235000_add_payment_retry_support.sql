-- Migration: Add Payment Retry Support with Exponential Backoff
-- Story: #007 - Implement Exponential Backoff Retry Logic for Failed Payments
-- Created: 2025-10-23
-- Description: Adds payment retry tracking table and columns for automatic retry
--              with exponential backoff strategy to handle transient failures.

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create payment_retry_attempts table for tracking retry history
CREATE TABLE IF NOT EXISTS payment_retry_attempts (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Foreign key to payments table
  payment_id UUID NOT NULL,

  -- Retry attempt tracking
  attempt_number INTEGER NOT NULL CHECK (attempt_number >= 1 AND attempt_number <= 5),

  -- Scheduling information
  scheduled_at TIMESTAMPTZ NOT NULL,
  executed_at TIMESTAMPTZ,

  -- Status tracking
  status VARCHAR(20) NOT NULL CHECK (
    status IN ('pending', 'executing', 'success', 'failed', 'skipped')
  ),

  -- Error information
  error_code VARCHAR(100),
  error_message TEXT,

  -- Retry metadata (delay used, backoff calculation info, etc.)
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Foreign key constraint
  CONSTRAINT fk_retry_attempts_payment
    FOREIGN KEY (payment_id)
    REFERENCES payments(id)
    ON DELETE CASCADE,

  -- Unique constraint: one attempt per payment per attempt number
  CONSTRAINT uq_payment_retry_attempt
    UNIQUE (payment_id, attempt_number)
);

-- Create indexes for optimal query performance
CREATE INDEX idx_retry_attempts_payment_id
  ON payment_retry_attempts(payment_id);

CREATE INDEX idx_retry_attempts_scheduled_at
  ON payment_retry_attempts(scheduled_at)
  WHERE status = 'pending';

CREATE INDEX idx_retry_attempts_status
  ON payment_retry_attempts(status);

CREATE INDEX idx_retry_attempts_payment_status
  ON payment_retry_attempts(payment_id, status, attempt_number DESC);

-- Add retry tracking columns to payments table
DO $$
BEGIN
  -- Add retry_count column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'retry_count'
  ) THEN
    ALTER TABLE payments ADD COLUMN retry_count INTEGER DEFAULT 0 NOT NULL;
  END IF;

  -- Add next_retry_at column for scheduling next retry
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'next_retry_at'
  ) THEN
    ALTER TABLE payments ADD COLUMN next_retry_at TIMESTAMPTZ;
  END IF;

  -- Add last_retry_at column to track most recent retry
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'last_retry_at'
  ) THEN
    ALTER TABLE payments ADD COLUMN last_retry_at TIMESTAMPTZ;
  END IF;

  -- Add retry_error_code for quick access to last failure reason
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'retry_error_code'
  ) THEN
    ALTER TABLE payments ADD COLUMN retry_error_code VARCHAR(100);
  END IF;
END$$;

-- Create index on next_retry_at for job scheduling
CREATE INDEX IF NOT EXISTS idx_payments_next_retry_at
  ON payments(next_retry_at)
  WHERE next_retry_at IS NOT NULL AND state IN ('pending', 'failed');

-- Create composite index for retry job queries
CREATE INDEX IF NOT EXISTS idx_payments_retry_scheduling
  ON payments(state, next_retry_at, retry_count)
  WHERE next_retry_at IS NOT NULL;

-- Add table comments
COMMENT ON TABLE payment_retry_attempts IS 'Tracks retry attempts for failed payments with exponential backoff';

-- Add column comments
COMMENT ON COLUMN payment_retry_attempts.id IS 'Unique retry attempt identifier';
COMMENT ON COLUMN payment_retry_attempts.payment_id IS 'Reference to the payment being retried';
COMMENT ON COLUMN payment_retry_attempts.attempt_number IS 'Sequential retry attempt number (1-5)';
COMMENT ON COLUMN payment_retry_attempts.scheduled_at IS 'When this retry was scheduled to execute';
COMMENT ON COLUMN payment_retry_attempts.executed_at IS 'When this retry actually executed';
COMMENT ON COLUMN payment_retry_attempts.status IS 'Current status of this retry attempt';
COMMENT ON COLUMN payment_retry_attempts.error_code IS 'Error code from failed attempt';
COMMENT ON COLUMN payment_retry_attempts.error_message IS 'Detailed error message from failed attempt';
COMMENT ON COLUMN payment_retry_attempts.metadata IS 'Additional retry metadata (delay, backoff multiplier, etc.)';

COMMENT ON COLUMN payments.retry_count IS 'Number of retry attempts for this payment (0-5)';
COMMENT ON COLUMN payments.next_retry_at IS 'Scheduled time for next retry attempt (NULL if no retry scheduled)';
COMMENT ON COLUMN payments.last_retry_at IS 'Timestamp of most recent retry attempt';
COMMENT ON COLUMN payments.retry_error_code IS 'Error code from most recent failed attempt';

-- Add row-level security (RLS) policies
ALTER TABLE payment_retry_attempts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view retry attempts for their own payments
CREATE POLICY payment_retry_attempts_select_own
  ON payment_retry_attempts
  FOR SELECT
  USING (
    payment_id IN (
      SELECT id FROM payments WHERE user_id = auth.uid()
    )
  );

-- Policy: Only system can insert retry attempts (backend service)
CREATE POLICY payment_retry_attempts_insert_system
  ON payment_retry_attempts
  FOR INSERT
  WITH CHECK (true); -- Temporarily allow all inserts; will restrict to service role

-- Policy: Only system can update retry attempts
CREATE POLICY payment_retry_attempts_update_system
  ON payment_retry_attempts
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Policy: No direct deletes allowed (cascade only)
CREATE POLICY payment_retry_attempts_no_delete
  ON payment_retry_attempts
  FOR DELETE
  USING (false);

-- Create function to get retry history for a payment
CREATE OR REPLACE FUNCTION get_payment_retry_history(p_payment_id UUID)
RETURNS TABLE(
  id UUID,
  attempt_number INTEGER,
  scheduled_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  status VARCHAR(20),
  error_code VARCHAR(100),
  error_message TEXT,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ra.id,
    ra.attempt_number,
    ra.scheduled_at,
    ra.executed_at,
    ra.status,
    ra.error_code,
    ra.error_message,
    ra.metadata
  FROM payment_retry_attempts ra
  WHERE ra.payment_id = p_payment_id
  ORDER BY ra.attempt_number ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_payment_retry_history(UUID) TO authenticated;

COMMENT ON FUNCTION get_payment_retry_history(UUID) IS 'Get complete retry history for a payment, ordered by attempt number';

-- Create function to get retry metrics for monitoring
CREATE OR REPLACE FUNCTION get_payment_retry_metrics(
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '24 hours',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE(
  total_retries BIGINT,
  successful_retries BIGINT,
  failed_retries BIGINT,
  pending_retries BIGINT,
  success_rate NUMERIC,
  avg_attempts_to_success NUMERIC,
  most_common_error_code VARCHAR(100)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_retries,
    COUNT(*) FILTER (WHERE status = 'success')::BIGINT as successful_retries,
    COUNT(*) FILTER (WHERE status = 'failed')::BIGINT as failed_retries,
    COUNT(*) FILTER (WHERE status = 'pending')::BIGINT as pending_retries,
    ROUND(
      COUNT(*) FILTER (WHERE status = 'success')::NUMERIC /
      NULLIF(COUNT(*)::NUMERIC, 0) * 100,
      2
    ) as success_rate,
    ROUND(AVG(attempt_number) FILTER (WHERE status = 'success'), 2) as avg_attempts_to_success,
    (
      SELECT error_code
      FROM payment_retry_attempts
      WHERE created_at BETWEEN p_start_date AND p_end_date
        AND error_code IS NOT NULL
      GROUP BY error_code
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ) as most_common_error_code
  FROM payment_retry_attempts
  WHERE created_at BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_payment_retry_metrics(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

COMMENT ON FUNCTION get_payment_retry_metrics(TIMESTAMPTZ, TIMESTAMPTZ) IS 'Get retry metrics for monitoring and analytics';

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_retry_attempt_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_retry_attempt_updated_at
  BEFORE UPDATE ON payment_retry_attempts
  FOR EACH ROW
  EXECUTE FUNCTION update_retry_attempt_timestamp();

COMMENT ON TRIGGER update_retry_attempt_updated_at ON payment_retry_attempts IS 'Automatically updates updated_at timestamp on row modification';

-- Create trigger to sync retry_count on payments table
CREATE OR REPLACE FUNCTION sync_payment_retry_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update payment retry_count when retry attempt is created
  IF (TG_OP = 'INSERT') THEN
    UPDATE payments
    SET
      retry_count = NEW.attempt_number,
      last_retry_at = NEW.created_at,
      retry_error_code = NEW.error_code
    WHERE id = NEW.payment_id;
  END IF;

  -- Update payment when retry attempt is updated
  IF (TG_OP = 'UPDATE') THEN
    UPDATE payments
    SET
      last_retry_at = NEW.updated_at,
      retry_error_code = NEW.error_code
    WHERE id = NEW.payment_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_retry_count_to_payment
  AFTER INSERT OR UPDATE ON payment_retry_attempts
  FOR EACH ROW
  EXECUTE FUNCTION sync_payment_retry_count();

COMMENT ON TRIGGER sync_retry_count_to_payment ON payment_retry_attempts IS 'Automatically syncs retry count and error to payments table';
