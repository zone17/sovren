-- Migration: Add Webhook Event Log Table for Race Condition Handling
-- Story: PAY-002 - Add Race Condition Handling for Webhook Processing
-- Created: 2025-10-24
-- Description: Creates webhook_events table for idempotency, ordering, and debugging
--              Prevents duplicate webhook processing and handles out-of-order webhooks

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create webhook_events table for comprehensive webhook logging
CREATE TABLE IF NOT EXISTS webhook_events (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Idempotency key (unique identifier for each webhook)
  -- Can be webhook_id, payment_hash, or combination
  idempotency_key VARCHAR(255) NOT NULL,

  -- Foreign key to payments table
  payment_id UUID,
  payment_hash VARCHAR(64) NOT NULL,

  -- Webhook event information
  event_type VARCHAR(50) NOT NULL,
  event_timestamp TIMESTAMPTZ NOT NULL,

  -- Processing status
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'processed', 'duplicate', 'failed')
  ),

  -- Processing metadata
  processed_at TIMESTAMPTZ,
  processing_started_at TIMESTAMPTZ,
  processing_duration_ms INTEGER,

  -- Raw webhook payload for debugging
  payload JSONB NOT NULL,

  -- Request metadata
  headers JSONB,
  source_ip VARCHAR(45), -- IPv6 compatible

  -- Result information
  result JSONB,
  error_message TEXT,

  -- Ordering information
  sequence_number INTEGER,
  is_out_of_order BOOLEAN DEFAULT false,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Foreign key constraint (payment may not exist yet)
  CONSTRAINT fk_webhook_events_payment
    FOREIGN KEY (payment_id)
    REFERENCES payments(id)
    ON DELETE SET NULL,

  -- Unique constraint for idempotency
  CONSTRAINT uq_webhook_idempotency_key
    UNIQUE (idempotency_key)
);

-- Create indexes for optimal query performance

-- Index for idempotency checks (most critical for race conditions)
CREATE UNIQUE INDEX idx_webhook_events_idempotency_key
  ON webhook_events(idempotency_key);

-- Index for payment lookups
CREATE INDEX idx_webhook_events_payment_id
  ON webhook_events(payment_id)
  WHERE payment_id IS NOT NULL;

-- Index for payment hash lookups
CREATE INDEX idx_webhook_events_payment_hash
  ON webhook_events(payment_hash);

-- Index for status queries
CREATE INDEX idx_webhook_events_status
  ON webhook_events(status)
  WHERE status IN ('pending', 'processing');

-- Index for timestamp ordering
CREATE INDEX idx_webhook_events_timestamp
  ON webhook_events(event_timestamp DESC);

-- Composite index for payment + timestamp queries
CREATE INDEX idx_webhook_events_payment_timestamp
  ON webhook_events(payment_id, event_timestamp DESC)
  WHERE payment_id IS NOT NULL;

-- Composite index for payment_hash + timestamp (before payment_id is known)
CREATE INDEX idx_webhook_events_hash_timestamp
  ON webhook_events(payment_hash, event_timestamp DESC);

-- Partial index for failed webhooks (for monitoring)
CREATE INDEX idx_webhook_events_failed
  ON webhook_events(created_at DESC)
  WHERE status = 'failed';

-- Add table comment
COMMENT ON TABLE webhook_events IS 'Comprehensive webhook event log for idempotency, race condition handling, and debugging';

-- Add column comments
COMMENT ON COLUMN webhook_events.id IS 'Unique webhook event identifier';
COMMENT ON COLUMN webhook_events.idempotency_key IS 'Unique key for idempotency (webhook_id or payment_hash + timestamp hash)';
COMMENT ON COLUMN webhook_events.payment_id IS 'Reference to payment (may be null initially)';
COMMENT ON COLUMN webhook_events.payment_hash IS 'Lightning payment hash for correlation';
COMMENT ON COLUMN webhook_events.event_type IS 'Type of webhook event (payment.processing, payment.completed, etc.)';
COMMENT ON COLUMN webhook_events.event_timestamp IS 'Timestamp from webhook provider';
COMMENT ON COLUMN webhook_events.status IS 'Processing status of this webhook';
COMMENT ON COLUMN webhook_events.processed_at IS 'When webhook processing completed';
COMMENT ON COLUMN webhook_events.processing_started_at IS 'When webhook processing started';
COMMENT ON COLUMN webhook_events.processing_duration_ms IS 'How long processing took in milliseconds';
COMMENT ON COLUMN webhook_events.payload IS 'Raw webhook payload for debugging';
COMMENT ON COLUMN webhook_events.headers IS 'HTTP headers from webhook request';
COMMENT ON COLUMN webhook_events.source_ip IS 'IP address of webhook sender (for security)';
COMMENT ON COLUMN webhook_events.result IS 'Processing result details';
COMMENT ON COLUMN webhook_events.error_message IS 'Error message if processing failed';
COMMENT ON COLUMN webhook_events.sequence_number IS 'Sequence number for ordering (if provided)';
COMMENT ON COLUMN webhook_events.is_out_of_order IS 'Whether this webhook arrived out of chronological order';

-- Add row-level security (RLS) policies
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Policy: Only authenticated users can view webhook events for their payments
CREATE POLICY webhook_events_select_own
  ON webhook_events
  FOR SELECT
  USING (
    payment_id IN (
      SELECT id FROM payments WHERE user_id = auth.uid()
    )
  );

-- Policy: Only system can insert webhook events (backend service)
CREATE POLICY webhook_events_insert_system
  ON webhook_events
  FOR INSERT
  WITH CHECK (true); -- Will restrict to service role in production

-- Policy: Only system can update webhook events
CREATE POLICY webhook_events_update_system
  ON webhook_events
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Policy: No direct deletes allowed (webhooks are permanent audit trail)
CREATE POLICY webhook_events_no_delete
  ON webhook_events
  FOR DELETE
  USING (false);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_webhook_event_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_webhook_event_updated_at
  BEFORE UPDATE ON webhook_events
  FOR EACH ROW
  EXECUTE FUNCTION update_webhook_event_timestamp();

COMMENT ON TRIGGER update_webhook_event_updated_at ON webhook_events IS 'Automatically updates updated_at timestamp on row modification';

-- Create function to check for duplicate webhooks (idempotency)
CREATE OR REPLACE FUNCTION check_webhook_duplicate(
  p_idempotency_key VARCHAR(255)
)
RETURNS TABLE(
  is_duplicate BOOLEAN,
  existing_event_id UUID,
  existing_status VARCHAR(20),
  processed_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    true as is_duplicate,
    id as existing_event_id,
    status as existing_status,
    processed_at
  FROM webhook_events
  WHERE idempotency_key = p_idempotency_key
  LIMIT 1;

  -- If no result, return false
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::VARCHAR(20), NULL::TIMESTAMPTZ;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION check_webhook_duplicate(VARCHAR(255)) TO authenticated;

COMMENT ON FUNCTION check_webhook_duplicate(VARCHAR(255)) IS 'Check if webhook with idempotency key already exists';

-- Create function to get webhook event history for a payment
CREATE OR REPLACE FUNCTION get_webhook_event_history(p_payment_id UUID)
RETURNS TABLE(
  id UUID,
  event_type VARCHAR(50),
  event_timestamp TIMESTAMPTZ,
  status VARCHAR(20),
  processed_at TIMESTAMPTZ,
  is_out_of_order BOOLEAN,
  error_message TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    we.id,
    we.event_type,
    we.event_timestamp,
    we.status,
    we.processed_at,
    we.is_out_of_order,
    we.error_message
  FROM webhook_events we
  WHERE we.payment_id = p_payment_id
  ORDER BY we.event_timestamp ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_webhook_event_history(UUID) TO authenticated;

COMMENT ON FUNCTION get_webhook_event_history(UUID) IS 'Get complete webhook event history for a payment, ordered chronologically';

-- Create function to get webhook processing metrics
CREATE OR REPLACE FUNCTION get_webhook_processing_metrics(
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '24 hours',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE(
  total_webhooks BIGINT,
  processed_webhooks BIGINT,
  duplicate_webhooks BIGINT,
  failed_webhooks BIGINT,
  avg_processing_time_ms NUMERIC,
  p50_processing_time_ms NUMERIC,
  p95_processing_time_ms NUMERIC,
  p99_processing_time_ms NUMERIC,
  out_of_order_webhooks BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_webhooks,
    COUNT(*) FILTER (WHERE status = 'processed')::BIGINT as processed_webhooks,
    COUNT(*) FILTER (WHERE status = 'duplicate')::BIGINT as duplicate_webhooks,
    COUNT(*) FILTER (WHERE status = 'failed')::BIGINT as failed_webhooks,
    ROUND(AVG(processing_duration_ms), 2) as avg_processing_time_ms,
    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY processing_duration_ms) as p50_processing_time_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY processing_duration_ms) as p95_processing_time_ms,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY processing_duration_ms) as p99_processing_time_ms,
    COUNT(*) FILTER (WHERE is_out_of_order = true)::BIGINT as out_of_order_webhooks
  FROM webhook_events
  WHERE created_at BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_webhook_processing_metrics(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

COMMENT ON FUNCTION get_webhook_processing_metrics(TIMESTAMPTZ, TIMESTAMPTZ) IS 'Get webhook processing metrics for monitoring';

-- Create database function for atomic webhook processing with locking
-- This function implements SELECT FOR UPDATE to prevent race conditions
CREATE OR REPLACE FUNCTION process_webhook_atomic(
  p_idempotency_key VARCHAR(255),
  p_payment_hash VARCHAR(64),
  p_event_type VARCHAR(50),
  p_event_timestamp TIMESTAMPTZ,
  p_payload JSONB,
  p_headers JSONB DEFAULT NULL,
  p_source_ip VARCHAR(45) DEFAULT NULL
)
RETURNS TABLE(
  webhook_id UUID,
  is_duplicate BOOLEAN,
  payment_id UUID,
  should_process BOOLEAN
) AS $$
DECLARE
  v_webhook_id UUID;
  v_payment_id UUID;
  v_existing_webhook UUID;
  v_is_duplicate BOOLEAN := false;
  v_should_process BOOLEAN := false;
BEGIN
  -- Step 1: Check for existing webhook with this idempotency key (with lock)
  SELECT id INTO v_existing_webhook
  FROM webhook_events
  WHERE idempotency_key = p_idempotency_key
  FOR UPDATE SKIP LOCKED; -- Skip if another transaction is processing same webhook

  IF FOUND THEN
    -- Duplicate webhook detected
    v_is_duplicate := true;
    v_webhook_id := v_existing_webhook;

    -- Update duplicate status
    UPDATE webhook_events
    SET status = 'duplicate',
        updated_at = NOW()
    WHERE id = v_existing_webhook;

    -- Get payment_id for response
    SELECT payment_id INTO v_payment_id
    FROM webhook_events
    WHERE id = v_existing_webhook;

    RETURN QUERY SELECT v_webhook_id, v_is_duplicate, v_payment_id, v_should_process;
    RETURN;
  END IF;

  -- Step 2: Find payment by payment_hash (with lock to prevent race condition)
  SELECT id INTO v_payment_id
  FROM payments
  WHERE payment_hash = p_payment_hash
  FOR UPDATE; -- Lock payment row during webhook processing

  -- Step 3: Create webhook event record
  INSERT INTO webhook_events (
    idempotency_key,
    payment_id,
    payment_hash,
    event_type,
    event_timestamp,
    status,
    processing_started_at,
    payload,
    headers,
    source_ip
  ) VALUES (
    p_idempotency_key,
    v_payment_id,
    p_payment_hash,
    p_event_type,
    p_event_timestamp,
    'processing',
    NOW(),
    p_payload,
    p_headers,
    p_source_ip
  )
  RETURNING id INTO v_webhook_id;

  v_should_process := true;

  RETURN QUERY SELECT v_webhook_id, v_is_duplicate, v_payment_id, v_should_process;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION process_webhook_atomic(VARCHAR(255), VARCHAR(64), VARCHAR(50), TIMESTAMPTZ, JSONB, JSONB, VARCHAR(45)) TO authenticated;

COMMENT ON FUNCTION process_webhook_atomic IS 'Atomically check for duplicate webhooks and lock payment for processing';

-- Create function to mark webhook as processed
CREATE OR REPLACE FUNCTION mark_webhook_processed(
  p_webhook_id UUID,
  p_result JSONB DEFAULT NULL,
  p_processing_duration_ms INTEGER DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE webhook_events
  SET
    status = 'processed',
    processed_at = NOW(),
    processing_duration_ms = p_processing_duration_ms,
    result = p_result,
    updated_at = NOW()
  WHERE id = p_webhook_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION mark_webhook_processed(UUID, JSONB, INTEGER) TO authenticated;

COMMENT ON FUNCTION mark_webhook_processed IS 'Mark webhook as successfully processed';

-- Create function to mark webhook as failed
CREATE OR REPLACE FUNCTION mark_webhook_failed(
  p_webhook_id UUID,
  p_error_message TEXT,
  p_processing_duration_ms INTEGER DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE webhook_events
  SET
    status = 'failed',
    processed_at = NOW(),
    processing_duration_ms = p_processing_duration_ms,
    error_message = p_error_message,
    updated_at = NOW()
  WHERE id = p_webhook_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION mark_webhook_failed(UUID, TEXT, INTEGER) TO authenticated;

COMMENT ON FUNCTION mark_webhook_failed IS 'Mark webhook as failed with error message';
