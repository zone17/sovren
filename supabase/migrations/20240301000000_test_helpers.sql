-- Test helper functions for backend integration tests.
-- These run with service_role privileges.

CREATE OR REPLACE FUNCTION truncate_test_tables()
RETURNS void AS $$
BEGIN
  -- Truncate in dependency order with CASCADE
  TRUNCATE TABLE
    content_analytics,
    payment_events,
    payment_retry_attempts,
    payment_lock_events,
    webhook_events,
    unified_session_activities,
    unified_sessions,
    user_behavior_events,
    session_activity,
    user_sessions,
    lightning_payments,
    lightning_invoices,
    transactions,
    transaction_exports,
    content_items,
    comments,
    followers,
    payments,
    content,
    users
  CASCADE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
