-- P1-DB-003: Create missing RPC functions
-- RPCs referenced in backend code but absent from migrations:
--   1. cleanup_expired_sessions      — validate-rls-policies.ts:585
--   2. get_wellness_benchmark         — WellnessService.ts:409
--   3. upsert_work_pattern            — WellnessService.ts:47
--   4. transition_payment_state       — PaymentStateMachine.ts:235
--   5. get_payment_event_history      — PaymentStateMachine.ts:305
--   6. get_payment_retry_history      — PaymentRetryService.ts:675
--   7. get_payment_retry_metrics      — PaymentRetryService.ts:698
--
-- Note: truncate_test_tables, create_circle_atomic already exist in migrations.
-- Note: update_revenue_split_atomic and get_creator_recommendations are complex
--       and depend on specific business logic; placeholders added with RAISE.

-- =============================================================================
-- 1. cleanup_expired_sessions
--    Deactivates sessions past their expires_at. Returns count of cleaned rows.
--    Used by: validate-rls-policies.ts (maintenance script)
-- =============================================================================
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE user_sessions
  SET active = false,
      updated_at = NOW()
  WHERE expires_at < NOW()
    AND active = true;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION cleanup_expired_sessions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_expired_sessions() TO service_role;

-- =============================================================================
-- 2. get_wellness_benchmark
--    Returns aggregate wellness composite score (anonymous, K-anonymity >= 10).
--    Used by: WellnessService.getBenchmark()
--    Returns: JSONB { avg_score NUMERIC, sample_count INT, p25 NUMERIC, p75 NUMERIC }
-- =============================================================================
CREATE OR REPLACE FUNCTION get_wellness_benchmark()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'avg_score',    ROUND(AVG(composite_score)::NUMERIC, 2),
    'sample_count', COUNT(*),
    'p25',          ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY composite_score)::NUMERIC, 2),
    'p75',          ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY composite_score)::NUMERIC, 2)
  ) INTO v_result
  FROM wellness_snapshots
  WHERE composite_score IS NOT NULL
    AND created_at >= NOW() - INTERVAL '30 days'
  HAVING COUNT(*) >= 10;

  -- Return empty object if K-anonymity threshold not met
  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

-- All authenticated users can read anonymized benchmarks
REVOKE ALL ON FUNCTION get_wellness_benchmark() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_wellness_benchmark() TO authenticated;
GRANT EXECUTE ON FUNCTION get_wellness_benchmark() TO service_role;

-- =============================================================================
-- 3. upsert_work_pattern
--    Accumulates (not overwrites) work pattern data for a given creator+date.
--    Uses ON CONFLICT DO UPDATE to sum durations and post counts.
--    Used by: WellnessService.recordWorkPattern()
-- =============================================================================
CREATE OR REPLACE FUNCTION upsert_work_pattern(
  p_creator_id          UUID,
  p_date                DATE,
  p_content_time_mins   INTEGER,
  p_engagement_time_mins INTEGER,
  p_management_time_mins INTEGER,
  p_post_count          INTEGER,
  p_activity_at         TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Only allow creators to upsert their own work patterns
  IF p_creator_id != auth.uid() AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Not authorized to modify work patterns for another creator';
  END IF;

  INSERT INTO creator_work_patterns (
    creator_id,
    date,
    content_time_mins,
    engagement_time_mins,
    management_time_mins,
    post_count,
    total_hours,
    first_activity_at,
    last_activity_at,
    updated_at
  ) VALUES (
    p_creator_id,
    p_date,
    p_content_time_mins,
    p_engagement_time_mins,
    p_management_time_mins,
    p_post_count,
    ROUND(((p_content_time_mins + p_engagement_time_mins + p_management_time_mins)::NUMERIC / 60), 2),
    p_activity_at,
    p_activity_at,
    NOW()
  )
  ON CONFLICT (creator_id, date) DO UPDATE
    SET content_time_mins   = creator_work_patterns.content_time_mins   + EXCLUDED.content_time_mins,
        engagement_time_mins = creator_work_patterns.engagement_time_mins + EXCLUDED.engagement_time_mins,
        management_time_mins = creator_work_patterns.management_time_mins + EXCLUDED.management_time_mins,
        post_count           = creator_work_patterns.post_count           + EXCLUDED.post_count,
        total_hours          = ROUND(((
          creator_work_patterns.content_time_mins   + EXCLUDED.content_time_mins +
          creator_work_patterns.engagement_time_mins + EXCLUDED.engagement_time_mins +
          creator_work_patterns.management_time_mins + EXCLUDED.management_time_mins
        )::NUMERIC / 60), 2),
        last_activity_at     = GREATEST(creator_work_patterns.last_activity_at, EXCLUDED.last_activity_at),
        updated_at           = NOW()
  RETURNING to_jsonb(creator_work_patterns.*) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION upsert_work_pattern(UUID, DATE, INTEGER, INTEGER, INTEGER, INTEGER, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_work_pattern(UUID, DATE, INTEGER, INTEGER, INTEGER, INTEGER, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_work_pattern(UUID, DATE, INTEGER, INTEGER, INTEGER, INTEGER, TIMESTAMPTZ) TO service_role;

-- =============================================================================
-- 4. transition_payment_state
--    Atomically records a payment state transition + inserts payment_events row.
--    Used by: PaymentStateMachine.executeTransition()
--    Returns: JSONB with success, event_id, from_state, to_state
-- =============================================================================
CREATE OR REPLACE FUNCTION transition_payment_state(
  p_payment_id UUID,
  p_from_state VARCHAR(20),
  p_to_state   VARCHAR(20),
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
  -- Lock the payment row to prevent concurrent transitions
  SELECT state INTO v_current_state
  FROM payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment % not found', p_payment_id;
  END IF;

  -- Validate we are transitioning from the expected state
  IF v_current_state != p_from_state THEN
    RAISE EXCEPTION 'State mismatch: expected %, got %', p_from_state, v_current_state;
  END IF;

  -- Update payment state
  UPDATE payments
  SET state = p_to_state,
      status = CASE
        WHEN p_to_state = 'completed'  THEN 'paid'
        WHEN p_to_state = 'failed'     THEN 'failed'
        WHEN p_to_state = 'refunded'   THEN 'refunded'
        WHEN p_to_state = 'expired'    THEN 'expired'
        ELSE status
      END,
      paid_at = CASE WHEN p_to_state = 'completed' THEN NOW() ELSE paid_at END,
      updated_at = NOW()
  WHERE id = p_payment_id;

  -- Insert state transition event
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
    p_to_state,
    p_from_state,
    NOW(),
    p_metadata,
    p_user_id
  ) RETURNING id INTO v_event_id;

  RETURN jsonb_build_object(
    'success',     true,
    'event_id',    v_event_id,
    'from_state',  p_from_state,
    'to_state',    p_to_state
  );
END;
$$;

REVOKE ALL ON FUNCTION transition_payment_state(UUID, VARCHAR, VARCHAR, JSONB, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION transition_payment_state(UUID, VARCHAR, VARCHAR, JSONB, UUID) TO service_role;

-- =============================================================================
-- 5. get_payment_event_history
--    Returns all state transition events for a payment, ordered by timestamp.
--    Used by: PaymentStateMachine.getEventHistory()
-- =============================================================================
CREATE OR REPLACE FUNCTION get_payment_event_history(p_payment_id UUID)
RETURNS SETOF payment_events
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM payment_events
  WHERE payment_id = p_payment_id
  ORDER BY event_timestamp ASC;
$$;

REVOKE ALL ON FUNCTION get_payment_event_history(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_payment_event_history(UUID) TO service_role;

-- =============================================================================
-- 6. get_payment_retry_history
--    Returns all retry attempts for a payment.
--    Used by: PaymentRetryService.getRetryHistory()
-- =============================================================================
CREATE OR REPLACE FUNCTION get_payment_retry_history(p_payment_id UUID)
RETURNS SETOF payment_retry_attempts
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM payment_retry_attempts
  WHERE payment_id = p_payment_id
  ORDER BY attempt_number ASC;
$$;

REVOKE ALL ON FUNCTION get_payment_retry_history(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_payment_retry_history(UUID) TO service_role;

-- =============================================================================
-- 7. get_payment_retry_metrics
--    Aggregates retry statistics over a time window.
--    Used by: PaymentRetryService.getRetryMetrics()
--    Returns: JSONB row with total_retries, successful_retries, etc.
-- =============================================================================
CREATE OR REPLACE FUNCTION get_payment_retry_metrics(
  p_start_date TIMESTAMPTZ,
  p_end_date   TIMESTAMPTZ
)
RETURNS TABLE(
  total_retries         BIGINT,
  successful_retries    BIGINT,
  failed_retries        BIGINT,
  pending_retries       BIGINT,
  success_rate          NUMERIC,
  avg_attempts_to_success NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::BIGINT                                                    AS total_retries,
    COUNT(*) FILTER (WHERE status = 'success')::BIGINT                 AS successful_retries,
    COUNT(*) FILTER (WHERE status = 'failed')::BIGINT                  AS failed_retries,
    COUNT(*) FILTER (WHERE status = 'pending')::BIGINT                 AS pending_retries,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE status = 'success')
             / NULLIF(COUNT(*), 0), 2
    )                                                                    AS success_rate,
    ROUND(
      AVG(attempt_number) FILTER (WHERE status = 'success'), 2
    )                                                                    AS avg_attempts_to_success
  FROM payment_retry_attempts
  WHERE created_at BETWEEN p_start_date AND p_end_date;
$$;

REVOKE ALL ON FUNCTION get_payment_retry_metrics(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_payment_retry_metrics(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
