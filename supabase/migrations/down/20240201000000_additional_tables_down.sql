-- =============================================================================
-- Rollback: 20240201000000_additional_tables.sql
-- Drops all tables created by the additional_tables migration in reverse
-- dependency order (children before parents).
--
-- Idempotent: uses DROP TABLE IF EXISTS ... CASCADE throughout.
-- Does NOT drop the baseline tables (users, content, payments, etc.)
-- nor the uuid-ossp extension — those belong to the baseline migration.
--
-- Also removes the ALTER TABLE columns added to the baseline `payments` table.
-- =============================================================================

BEGIN;

-- =============================================================================
-- SECTION 6 (reverse): System/admin + misc leaf tables
-- =============================================================================

DROP TABLE IF EXISTS system_logs CASCADE;
DROP TABLE IF EXISTS auto_tagging_configs CASCADE;

-- =============================================================================
-- Provenance tables
-- =============================================================================

DROP TABLE IF EXISTS content_alerts CASCADE;
DROP TABLE IF EXISTS content_fingerprints CASCADE;
DROP TABLE IF EXISTS provenance_records CASCADE;

-- =============================================================================
-- Wellness/burnout tables
-- =============================================================================

DROP TABLE IF EXISTS creator_boundaries CASCADE;
DROP TABLE IF EXISTS burnout_risk_history CASCADE;
DROP TABLE IF EXISTS wellness_benchmarks CASCADE;
DROP TABLE IF EXISTS wellness_snapshots CASCADE;
DROP TABLE IF EXISTS creator_work_patterns CASCADE;

-- =============================================================================
-- Creator discovery tables
-- =============================================================================

DROP TABLE IF EXISTS follow_relationships CASCADE;
DROP TABLE IF EXISTS creator_discovery_sessions CASCADE;
DROP TABLE IF EXISTS creator_interest_mapping CASCADE;
DROP TABLE IF EXISTS user_interest_mapping CASCADE;
DROP TABLE IF EXISTS interest_taxonomy CASCADE;
DROP TABLE IF EXISTS creator_profiles CASCADE;
DROP TABLE IF EXISTS creators CASCADE;

-- =============================================================================
-- AI / Recommendation tables
-- =============================================================================

DROP TABLE IF EXISTS content_similarity CASCADE;
DROP TABLE IF EXISTS related_content_interactions CASCADE;
DROP TABLE IF EXISTS related_content_analytics CASCADE;
DROP TABLE IF EXISTS cluster_analytics CASCADE;
DROP TABLE IF EXISTS content_clusters CASCADE;
DROP TABLE IF EXISTS extracted_topics CASCADE;
DROP TABLE IF EXISTS content_tags CASCADE;
DROP TABLE IF EXISTS topic_trends CASCADE;
DROP TABLE IF EXISTS tag_feedback CASCADE;

-- =============================================================================
-- CMS / content extension tables
-- =============================================================================

DROP TABLE IF EXISTS content_feedback CASCADE;
DROP TABLE IF EXISTS search_history CASCADE;
DROP TABLE IF EXISTS recommendation_feedback CASCADE;
DROP TABLE IF EXISTS content_series CASCADE;
DROP TABLE IF EXISTS content_collections CASCADE;
DROP TABLE IF EXISTS media_assets CASCADE;
DROP TABLE IF EXISTS content_items CASCADE;
DROP TABLE IF EXISTS content_categories CASCADE;
DROP TABLE IF EXISTS content_versions CASCADE;
DROP TABLE IF EXISTS content_views CASCADE;
DROP TABLE IF EXISTS premium_content_access CASCADE;

-- =============================================================================
-- Payment / transaction leaf tables
-- =============================================================================

DROP TABLE IF EXISTS transaction_exports CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS recurring_payments CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS subscription_tiers CASCADE;
DROP TABLE IF EXISTS payment_status_history CASCADE;
DROP TABLE IF EXISTS payment_verifications CASCADE;
DROP TABLE IF EXISTS nip05_verifications CASCADE;
DROP TABLE IF EXISTS payouts CASCADE;
DROP TABLE IF EXISTS payout_schedules CASCADE;

-- =============================================================================
-- SECTION 5 (reverse): Business Manager tables
-- =============================================================================

DROP TABLE IF EXISTS diversification_goals CASCADE;
DROP TABLE IF EXISTS revenue_entries CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS expense_categories CASCADE;
DROP TABLE IF EXISTS business_invoices CASCADE;
DROP TABLE IF EXISTS contracts CASCADE;
DROP TABLE IF EXISTS contract_templates CASCADE;

-- =============================================================================
-- SECTION 4 (reverse): EPIC-010 Creator Network tables
-- =============================================================================

-- revenue_split_payments references revenue_split_ledger → drop payments first
DROP TABLE IF EXISTS revenue_split_payments CASCADE;
DROP TABLE IF EXISTS revenue_split_ledger CASCADE;
DROP TABLE IF EXISTS order_reviews CASCADE;
DROP TABLE IF EXISTS service_orders CASCADE;
DROP TABLE IF EXISTS service_listings CASCADE;
DROP TABLE IF EXISTS content_collaborators CASCADE;
DROP TABLE IF EXISTS mentorships CASCADE;
DROP TABLE IF EXISTS mentor_profiles CASCADE;
DROP TABLE IF EXISTS circle_posts CASCADE;
DROP TABLE IF EXISTS circle_members CASCADE;
DROP TABLE IF EXISTS creator_circles CASCADE;
DROP TABLE IF EXISTS reply_templates CASCADE;

-- =============================================================================
-- SECTION 3 (reverse): EPIC-009 Platform Distribution tables
-- =============================================================================

DROP TABLE IF EXISTS platform_metrics_history CASCADE;
DROP TABLE IF EXISTS inbox_messages CASCADE;
DROP TABLE IF EXISTS repurposed_content CASCADE;
DROP TABLE IF EXISTS cross_posts CASCADE;
DROP TABLE IF EXISTS platform_connections CASCADE;

-- =============================================================================
-- Lightning / session stub tables (Section 6 backend-referenced)
-- =============================================================================

DROP TABLE IF EXISTS user_stats CASCADE;
DROP TABLE IF EXISTS user_wallet_providers CASCADE;
DROP TABLE IF EXISTS user_behavior_events CASCADE;
DROP TABLE IF EXISTS user_preferences CASCADE;
DROP TABLE IF EXISTS session_activity CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS lightning_webhooks CASCADE;
DROP TABLE IF EXISTS lightning_analytics CASCADE;
DROP TABLE IF EXISTS lightning_addresses CASCADE;
DROP TABLE IF EXISTS lightning_payments CASCADE;
DROP TABLE IF EXISTS lightning_invoices CASCADE;

-- =============================================================================
-- SECTION 2 (reverse): Payment / session audit tables
-- =============================================================================

DROP TABLE IF EXISTS unified_session_activities CASCADE;
DROP TABLE IF EXISTS unified_sessions CASCADE;
DROP TABLE IF EXISTS webhook_events CASCADE;
DROP TABLE IF EXISTS payment_lock_events CASCADE;
DROP TABLE IF EXISTS payment_retry_attempts CASCADE;
DROP TABLE IF EXISTS payment_events CASCADE;

-- =============================================================================
-- SECTION 1 (reverse): Remove columns added to baseline `payments` table
-- =============================================================================

ALTER TABLE payments DROP COLUMN IF EXISTS retry_error_code;
ALTER TABLE payments DROP COLUMN IF EXISTS last_retry_at;
ALTER TABLE payments DROP COLUMN IF EXISTS next_retry_at;
ALTER TABLE payments DROP COLUMN IF EXISTS metadata;
ALTER TABLE payments DROP COLUMN IF EXISTS last_error;
ALTER TABLE payments DROP COLUMN IF EXISTS retry_count;
ALTER TABLE payments DROP COLUMN IF EXISTS state;

COMMIT;
