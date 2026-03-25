-- P1-DB-001 (Phase 2): RLS for user data tables
-- Tables: user_sessions, user_preferences, user_wallet_providers, user_behavior_events,
--         user_stats, session_activity, unified_sessions, unified_session_activities,
--         lightning_addresses, lightning_analytics, lightning_webhooks,
--         subscription_tiers, payment_verifications, payment_status_history,
--         nip05_verifications (if exists)
--
-- Pattern: service_role bypass + owner-scoped SELECT.
-- Write operations (INSERT/UPDATE/DELETE) are restricted to service_role only.
-- Users can read their own rows; writes go through backend with service_role.

-- =============================================================================
-- 1. user_sessions — user_id references users(id)
-- =============================================================================
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_sessions_service_role" ON user_sessions
  USING (auth.role() = 'service_role');

CREATE POLICY "user_sessions_select_own" ON user_sessions
  FOR SELECT USING (user_id = auth.uid());

-- =============================================================================
-- 2. session_activity — session_id references user_sessions(id)
-- =============================================================================
ALTER TABLE session_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_activity_service_role" ON session_activity
  USING (auth.role() = 'service_role');

-- session_activity is read via JOIN with user_sessions; deny direct user reads.
-- Only service_role can access (security audit table).

-- =============================================================================
-- 3. unified_sessions — user_id is VARCHAR(100), pubkey is VARCHAR(64)
-- =============================================================================
ALTER TABLE unified_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "unified_sessions_service_role" ON unified_sessions
  USING (auth.role() = 'service_role');

-- No direct user SELECT — sessions managed via backend service_role only.

-- =============================================================================
-- 4. unified_session_activities — session_id references unified_sessions(id)
-- =============================================================================
ALTER TABLE unified_session_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "unified_session_activities_service_role" ON unified_session_activities
  USING (auth.role() = 'service_role');

-- =============================================================================
-- 5. user_preferences — user_id references users(id)
-- =============================================================================
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_preferences_service_role" ON user_preferences
  USING (auth.role() = 'service_role');

CREATE POLICY "user_preferences_select_own" ON user_preferences
  FOR SELECT USING (user_id = auth.uid());

-- =============================================================================
-- 6. user_wallet_providers — user_id references users(id)
-- =============================================================================
ALTER TABLE user_wallet_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_wallet_providers_service_role" ON user_wallet_providers
  USING (auth.role() = 'service_role');

CREATE POLICY "user_wallet_providers_select_own" ON user_wallet_providers
  FOR SELECT USING (user_id = auth.uid());

-- =============================================================================
-- 7. user_behavior_events — user_id references users(id)
-- =============================================================================
ALTER TABLE user_behavior_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_behavior_events_service_role" ON user_behavior_events
  USING (auth.role() = 'service_role');

CREATE POLICY "user_behavior_events_select_own" ON user_behavior_events
  FOR SELECT USING (user_id = auth.uid());

-- =============================================================================
-- 8. user_stats — user_id references users(id)
-- =============================================================================
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_stats_service_role" ON user_stats
  USING (auth.role() = 'service_role');

-- user_stats is public profile data; allow all authenticated users to read
CREATE POLICY "user_stats_select_authenticated" ON user_stats
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

-- =============================================================================
-- 9. lightning_addresses — user_id references users(id)
-- =============================================================================
ALTER TABLE lightning_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lightning_addresses_service_role" ON lightning_addresses
  USING (auth.role() = 'service_role');

-- Lightning addresses are public (needed for payments); allow authenticated reads
CREATE POLICY "lightning_addresses_select_authenticated" ON lightning_addresses
  FOR SELECT USING (auth.role() = 'authenticated');

-- =============================================================================
-- 10. lightning_analytics — user_id references users(id) (nullable)
-- =============================================================================
ALTER TABLE lightning_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lightning_analytics_service_role" ON lightning_analytics
  USING (auth.role() = 'service_role');

CREATE POLICY "lightning_analytics_select_own" ON lightning_analytics
  FOR SELECT USING (user_id = auth.uid());

-- =============================================================================
-- 11. lightning_webhooks — user_id references users(id) (nullable)
-- =============================================================================
ALTER TABLE lightning_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lightning_webhooks_service_role" ON lightning_webhooks
  USING (auth.role() = 'service_role');

CREATE POLICY "lightning_webhooks_select_own" ON lightning_webhooks
  FOR SELECT USING (user_id = auth.uid());

-- =============================================================================
-- 12. subscription_tiers — creator_id references users(id)
-- =============================================================================
ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscription_tiers_service_role" ON subscription_tiers
  USING (auth.role() = 'service_role');

-- Subscription tiers are public product data
CREATE POLICY "subscription_tiers_select_authenticated" ON subscription_tiers
  FOR SELECT USING (auth.role() = 'authenticated');

-- =============================================================================
-- 13. payment_verifications — payment_id references payments(id)
--     Audit/compliance table: read-only for owner, no direct write
-- =============================================================================
ALTER TABLE payment_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_verifications_service_role" ON payment_verifications
  USING (auth.role() = 'service_role');

-- =============================================================================
-- 14. payment_status_history — payment_id references payments(id)
--     Audit/compliance table: service_role only
-- =============================================================================
ALTER TABLE payment_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_status_history_service_role" ON payment_status_history
  USING (auth.role() = 'service_role');

-- =============================================================================
-- 15. payment_events — audit trail for payment state transitions
--     Service_role only (financial audit table)
-- =============================================================================
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_events_service_role" ON payment_events
  USING (auth.role() = 'service_role');

-- =============================================================================
-- 16. payment_retry_attempts — tracks retry history
--     Service_role only (operational/audit table)
-- =============================================================================
ALTER TABLE payment_retry_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_retry_attempts_service_role" ON payment_retry_attempts
  USING (auth.role() = 'service_role');

-- =============================================================================
-- 17. payment_lock_events — lock acquisition audit trail
--     Service_role only (operational/audit table)
-- =============================================================================
ALTER TABLE payment_lock_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_lock_events_service_role" ON payment_lock_events
  USING (auth.role() = 'service_role');

-- =============================================================================
-- 18. webhook_events — idempotent webhook processing log
--     Service_role only (internal system table)
-- =============================================================================
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_events_service_role" ON webhook_events
  USING (auth.role() = 'service_role');
