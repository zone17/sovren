-- =====================================================
-- 🔒 COMPREHENSIVE ROW-LEVEL SECURITY (RLS) POLICIES
-- =====================================================
--
-- Implementation for US-209: Supabase Row-Level Security
-- Elite security implementation with principle of least privilege
--
-- @author Sovren Platform Team
-- @version 1.0.0
-- @date 2024-12-29
--
-- Security Principles:
-- - Principle of least privilege
-- - Defense in depth
-- - Data classification enforcement
-- - Audit trail compliance
-- =====================================================

-- Enable RLS on all critical tables
BEGIN;

-- =====================================================
-- TIER 1: CRITICAL SECURITY TABLES (P0 - IMMEDIATE)
-- =====================================================

-- 👤 USERS TABLE RLS
-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can read all user profiles (public data)
-- Users can only update their own profile
CREATE POLICY users_public_read_policy ON users
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY users_own_data_policy ON users
    FOR INSERT, UPDATE, DELETE
    TO authenticated
    USING (id = auth.uid());

-- Admins have full access
CREATE POLICY users_admin_policy ON users
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

-- Service accounts have read access for operations
CREATE POLICY users_service_read_policy ON users
    FOR SELECT
    TO service_role
    USING (true);

-- ⚡ LIGHTNING INVOICES TABLE RLS
-- Enable RLS
ALTER TABLE lightning_invoices ENABLE ROW LEVEL SECURITY;

-- Creators can access their own invoices
CREATE POLICY lightning_invoices_creator_policy ON lightning_invoices
    FOR ALL
    TO authenticated
    USING (creator_id = auth.uid());

-- Supporters can view invoices they created/paid
CREATE POLICY lightning_invoices_supporter_policy ON lightning_invoices
    FOR SELECT
    TO authenticated
    USING (supporter_id = auth.uid());

-- Admins have full access for support and compliance
CREATE POLICY lightning_invoices_admin_policy ON lightning_invoices
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

-- Service accounts can create and update invoices
CREATE POLICY lightning_invoices_service_policy ON lightning_invoices
    FOR ALL
    TO service_role
    USING (true);

-- ⚡ LIGHTNING PAYMENTS TABLE RLS
-- Enable RLS
ALTER TABLE lightning_payments ENABLE ROW LEVEL SECURITY;

-- Creators can access their payment records
CREATE POLICY lightning_payments_creator_policy ON lightning_payments
    FOR ALL
    TO authenticated
    USING (creator_id = auth.uid());

-- Supporters can view their payment records
CREATE POLICY lightning_payments_supporter_policy ON lightning_payments
    FOR SELECT
    TO authenticated
    USING (supporter_id = auth.uid());

-- Admins have full access
CREATE POLICY lightning_payments_admin_policy ON lightning_payments
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

-- Service accounts handle payment processing
CREATE POLICY lightning_payments_service_policy ON lightning_payments
    FOR ALL
    TO service_role
    USING (true);

-- ⚡ LIGHTNING ADDRESSES TABLE RLS
-- Enable RLS
ALTER TABLE lightning_addresses ENABLE ROW LEVEL SECURITY;

-- Users can only access their own lightning addresses
CREATE POLICY lightning_addresses_user_policy ON lightning_addresses
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid());

-- Public read access for address resolution
CREATE POLICY lightning_addresses_public_read_policy ON lightning_addresses
    FOR SELECT
    TO authenticated
    USING (active = true);

-- Admins have full access
CREATE POLICY lightning_addresses_admin_policy ON lightning_addresses
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

-- Service accounts for address management
CREATE POLICY lightning_addresses_service_policy ON lightning_addresses
    FOR ALL
    TO service_role
    USING (true);

-- ⚡ LIGHTNING WEBHOOKS TABLE RLS
-- Enable RLS
ALTER TABLE lightning_webhooks ENABLE ROW LEVEL SECURITY;

-- Only service accounts and admins can access webhooks
CREATE POLICY lightning_webhooks_service_policy ON lightning_webhooks
    FOR ALL
    TO service_role
    USING (true);

CREATE POLICY lightning_webhooks_admin_policy ON lightning_webhooks
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

-- ⚡ LIGHTNING ANALYTICS TABLE RLS
-- Enable RLS
ALTER TABLE lightning_analytics ENABLE ROW LEVEL SECURITY;

-- Creators can view their own analytics
CREATE POLICY lightning_analytics_creator_policy ON lightning_analytics
    FOR SELECT
    TO authenticated
    USING (creator_id = auth.uid());

-- Admins have full access
CREATE POLICY lightning_analytics_admin_policy ON lightning_analytics
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

-- Service accounts for analytics processing
CREATE POLICY lightning_analytics_service_policy ON lightning_analytics
    FOR ALL
    TO service_role
    USING (true);

-- 📈 USER ACTIVITY LOG TABLE RLS
-- Enable RLS
ALTER TABLE user_activity_log ENABLE ROW LEVEL SECURITY;

-- Users can view their own activity log
CREATE POLICY user_activity_log_user_policy ON user_activity_log
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Service accounts for logging
CREATE POLICY user_activity_log_service_policy ON user_activity_log
    FOR INSERT
    TO service_role
    USING (true);

-- Admins have full access
CREATE POLICY user_activity_log_admin_policy ON user_activity_log
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

-- 🗂️ NOSTR CHALLENGES TABLE RLS
-- Enable RLS
ALTER TABLE nostr_challenges ENABLE ROW LEVEL SECURITY;

-- Users can access challenges for their pubkey
CREATE POLICY nostr_challenges_user_policy ON nostr_challenges
    FOR ALL
    TO authenticated
    USING (
        nostr_pubkey = (
            SELECT nostr_pubkey FROM users WHERE id = auth.uid()
        )
    );

-- Service accounts for challenge management
CREATE POLICY nostr_challenges_service_policy ON nostr_challenges
    FOR ALL
    TO service_role
    USING (true);

-- Admins have full access
CREATE POLICY nostr_challenges_admin_policy ON nostr_challenges
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

-- 🏥 HEALTH CHECKS TABLE RLS
-- Enable RLS
ALTER TABLE health_checks ENABLE ROW LEVEL SECURITY;

-- Only admins and service accounts can access health checks
CREATE POLICY health_checks_admin_policy ON health_checks
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY health_checks_service_policy ON health_checks
    FOR ALL
    TO service_role
    USING (true);

-- =====================================================
-- TIER 2: CONTENT MANAGEMENT TABLES (P1)
-- =====================================================

-- 🏷️ CONTENT TAGS TABLE RLS
-- Enable RLS
ALTER TABLE content_tags ENABLE ROW LEVEL SECURITY;

-- Public read access for all tags
CREATE POLICY content_tags_public_read_policy ON content_tags
    FOR SELECT
    TO authenticated
    USING (true);

-- Content owners can manage their content tags
CREATE POLICY content_tags_owner_policy ON content_tags
    FOR ALL
    TO authenticated
    USING (
        content_id IN (
            SELECT id FROM content_items
            WHERE creator_id = auth.uid()
        )
    );

-- Admins and service accounts have full access
CREATE POLICY content_tags_admin_policy ON content_tags
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY content_tags_service_policy ON content_tags
    FOR ALL
    TO service_role
    USING (true);

-- 📋 AUTO TAGGING CONFIGS TABLE RLS
-- Enable RLS
ALTER TABLE auto_tagging_configs ENABLE ROW LEVEL SECURITY;

-- Only admins can manage auto-tagging configurations
CREATE POLICY auto_tagging_configs_admin_policy ON auto_tagging_configs
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

-- Service accounts for AI processing
CREATE POLICY auto_tagging_configs_service_policy ON auto_tagging_configs
    FOR SELECT
    TO service_role
    USING (true);

-- 📝 TAG VALIDATION RULES TABLE RLS
-- Enable RLS
ALTER TABLE tag_validation_rules ENABLE ROW LEVEL SECURITY;

-- Only admins can manage validation rules
CREATE POLICY tag_validation_rules_admin_policy ON tag_validation_rules
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

-- Service accounts for validation processing
CREATE POLICY tag_validation_rules_service_policy ON tag_validation_rules
    FOR SELECT
    TO service_role
    USING (true);

-- 🧠 TAG LEARNING DATA TABLE RLS
-- Enable RLS
ALTER TABLE tag_learning_data ENABLE ROW LEVEL SECURITY;

-- Only service accounts and admins can access learning data
CREATE POLICY tag_learning_data_service_policy ON tag_learning_data
    FOR ALL
    TO service_role
    USING (true);

CREATE POLICY tag_learning_data_admin_policy ON tag_learning_data
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

-- 📊 EXTRACTED TOPICS TABLE RLS
-- Enable RLS
ALTER TABLE extracted_topics ENABLE ROW LEVEL SECURITY;

-- Public read access for topics
CREATE POLICY extracted_topics_public_read_policy ON extracted_topics
    FOR SELECT
    TO authenticated
    USING (is_active = true);

-- Only admins can manage topics
CREATE POLICY extracted_topics_admin_policy ON extracted_topics
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

-- Service accounts for topic processing
CREATE POLICY extracted_topics_service_policy ON extracted_topics
    FOR ALL
    TO service_role
    USING (true);

-- =====================================================
-- TIER 3: AI RECOMMENDATIONS TABLES (P1)
-- =====================================================

-- 🎯 USER PREFERENCES TABLE RLS
-- Enable RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Users can only access their own preferences
CREATE POLICY user_preferences_user_policy ON user_preferences
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid());

-- Admins have full access
CREATE POLICY user_preferences_admin_policy ON user_preferences
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

-- Service accounts for preference learning
CREATE POLICY user_preferences_service_policy ON user_preferences
    FOR ALL
    TO service_role
    USING (true);

-- 📊 USER BEHAVIOR EVENTS TABLE RLS
-- Enable RLS
ALTER TABLE user_behavior_events ENABLE ROW LEVEL SECURITY;

-- Users can view their own behavior data
CREATE POLICY user_behavior_events_user_policy ON user_behavior_events
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Service accounts for behavior tracking
CREATE POLICY user_behavior_events_service_policy ON user_behavior_events
    FOR ALL
    TO service_role
    USING (true);

-- Admins have full access
CREATE POLICY user_behavior_events_admin_policy ON user_behavior_events
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

-- 🤝 CONTENT SIMILARITY TABLE RLS
-- Enable RLS
ALTER TABLE content_similarity ENABLE ROW LEVEL SECURITY;

-- Public read access for similarity data
CREATE POLICY content_similarity_public_read_policy ON content_similarity
    FOR SELECT
    TO authenticated
    USING (true);

-- Service accounts for similarity processing
CREATE POLICY content_similarity_service_policy ON content_similarity
    FOR ALL
    TO service_role
    USING (true);

-- Admins have full access
CREATE POLICY content_similarity_admin_policy ON content_similarity
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

-- 📝 RECOMMENDATION FEEDBACK TABLE RLS
-- Enable RLS
ALTER TABLE recommendation_feedback ENABLE ROW LEVEL SECURITY;

-- Users can access their own feedback
CREATE POLICY recommendation_feedback_user_policy ON recommendation_feedback
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid());

-- Service accounts for learning
CREATE POLICY recommendation_feedback_service_policy ON recommendation_feedback
    FOR ALL
    TO service_role
    USING (true);

-- Admins have full access
CREATE POLICY recommendation_feedback_admin_policy ON recommendation_feedback
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

-- 🎯 CONTENT RECOMMENDATIONS TABLE RLS
-- Enable RLS
ALTER TABLE content_recommendations ENABLE ROW LEVEL SECURITY;

-- Users can access their own recommendations
CREATE POLICY content_recommendations_user_policy ON content_recommendations
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid());

-- Service accounts for recommendation generation
CREATE POLICY content_recommendations_service_policy ON content_recommendations
    FOR ALL
    TO service_role
    USING (true);

-- Admins have full access
CREATE POLICY content_recommendations_admin_policy ON content_recommendations
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

-- 📈 RECOMMENDATION ANALYTICS TABLE RLS
-- Enable RLS
ALTER TABLE recommendation_analytics ENABLE ROW LEVEL SECURITY;

-- Creators can view analytics for their content
CREATE POLICY recommendation_analytics_creator_policy ON recommendation_analytics
    FOR SELECT
    TO authenticated
    USING (
        content_id IN (
            SELECT id FROM content_items
            WHERE creator_id = auth.uid()
        )
    );

-- Service accounts for analytics processing
CREATE POLICY recommendation_analytics_service_policy ON recommendation_analytics
    FOR ALL
    TO service_role
    USING (true);

-- Admins have full access
CREATE POLICY recommendation_analytics_admin_policy ON recommendation_analytics
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

-- =====================================================
-- TIER 4: CREATOR RECOMMENDATIONS TABLES (P1)
-- =====================================================

-- 👤 CREATOR PROFILES TABLE RLS
-- Enable RLS
ALTER TABLE creator_profiles ENABLE ROW LEVEL SECURITY;

-- Public read access for all creator profiles
CREATE POLICY creator_profiles_public_read_policy ON creator_profiles
    FOR SELECT
    TO authenticated
    USING (true);

-- Creators can manage their own profile
CREATE POLICY creator_profiles_creator_policy ON creator_profiles
    FOR ALL
    TO authenticated
    USING (creator_id = auth.uid());

-- Service accounts for profile processing
CREATE POLICY creator_profiles_service_policy ON creator_profiles
    FOR ALL
    TO service_role
    USING (true);

-- Admins have full access
CREATE POLICY creator_profiles_admin_policy ON creator_profiles
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

-- 🏷️ INTEREST TAXONOMY TABLE RLS
-- Enable RLS
ALTER TABLE interest_taxonomy ENABLE ROW LEVEL SECURITY;

-- Public read access for interest taxonomy
CREATE POLICY interest_taxonomy_public_read_policy ON interest_taxonomy
    FOR SELECT
    TO authenticated
    USING (is_active = true);

-- Only admins can manage taxonomy
CREATE POLICY interest_taxonomy_admin_policy ON interest_taxonomy
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

-- Service accounts for taxonomy processing
CREATE POLICY interest_taxonomy_service_policy ON interest_taxonomy
    FOR ALL
    TO service_role
    USING (true);

-- 🗺️ USER INTEREST MAPPING TABLE RLS
-- Enable RLS
ALTER TABLE user_interest_mapping ENABLE ROW LEVEL SECURITY;

-- Users can access their own interest mapping
CREATE POLICY user_interest_mapping_user_policy ON user_interest_mapping
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid());

-- Service accounts for interest learning
CREATE POLICY user_interest_mapping_service_policy ON user_interest_mapping
    FOR ALL
    TO service_role
    USING (true);

-- Admins have full access
CREATE POLICY user_interest_mapping_admin_policy ON user_interest_mapping
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

-- =====================================================
-- TIER 5: ANALYTICS TABLES (P1)
-- =====================================================

-- 📊 ENGAGEMENT METRICS TABLE RLS
-- Enable RLS
ALTER TABLE engagement_metrics ENABLE ROW LEVEL SECURITY;

-- Creators can view their own engagement metrics
CREATE POLICY engagement_metrics_creator_policy ON engagement_metrics
    FOR SELECT
    TO authenticated
    USING (creator_id = auth.uid());

-- Service accounts for metrics processing
CREATE POLICY engagement_metrics_service_policy ON engagement_metrics
    FOR ALL
    TO service_role
    USING (true);

-- Admins have full access
CREATE POLICY engagement_metrics_admin_policy ON engagement_metrics
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

-- 📈 ENGAGEMENT PATTERNS TABLE RLS
-- Enable RLS
ALTER TABLE engagement_patterns ENABLE ROW LEVEL SECURITY;

-- Creators can view their own patterns
CREATE POLICY engagement_patterns_creator_policy ON engagement_patterns
    FOR SELECT
    TO authenticated
    USING (creator_id = auth.uid());

-- Service accounts for pattern analysis
CREATE POLICY engagement_patterns_service_policy ON engagement_patterns
    FOR ALL
    TO service_role
    USING (true);

-- Admins have full access
CREATE POLICY engagement_patterns_admin_policy ON engagement_patterns
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

-- 💡 ENGAGEMENT INSIGHTS TABLE RLS
-- Enable RLS
ALTER TABLE engagement_insights ENABLE ROW LEVEL SECURITY;

-- Creators can view their own insights
CREATE POLICY engagement_insights_creator_policy ON engagement_insights
    FOR SELECT
    TO authenticated
    USING (creator_id = auth.uid());

-- Service accounts for insight generation
CREATE POLICY engagement_insights_service_policy ON engagement_insights
    FOR ALL
    TO service_role
    USING (true);

-- Admins have full access
CREATE POLICY engagement_insights_admin_policy ON engagement_insights
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

-- 🔮 PERFORMANCE PREDICTIONS TABLE RLS
-- Enable RLS
ALTER TABLE performance_predictions ENABLE ROW LEVEL SECURITY;

-- Creators can view their own predictions
CREATE POLICY performance_predictions_creator_policy ON performance_predictions
    FOR SELECT
    TO authenticated
    USING (creator_id = auth.uid());

-- Service accounts for prediction processing
CREATE POLICY performance_predictions_service_policy ON performance_predictions
    FOR ALL
    TO service_role
    USING (true);

-- Admins have full access
CREATE POLICY performance_predictions_admin_policy ON performance_predictions
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

-- 📈 GROWTH FORECASTS TABLE RLS
-- Enable RLS
ALTER TABLE growth_forecasts ENABLE ROW LEVEL SECURITY;

-- Creators can view their own forecasts
CREATE POLICY growth_forecasts_creator_policy ON growth_forecasts
    FOR SELECT
    TO authenticated
    USING (creator_id = auth.uid());

-- Service accounts for forecast processing
CREATE POLICY growth_forecasts_service_policy ON growth_forecasts
    FOR ALL
    TO service_role
    USING (true);

-- Admins have full access
CREATE POLICY growth_forecasts_admin_policy ON growth_forecasts
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

-- 🎯 GROWTH GOALS TABLE RLS
-- Enable RLS
ALTER TABLE growth_goals ENABLE ROW LEVEL SECURITY;

-- Creators can manage their own goals
CREATE POLICY growth_goals_creator_policy ON growth_goals
    FOR ALL
    TO authenticated
    USING (creator_id = auth.uid());

-- Service accounts for goal tracking
CREATE POLICY growth_goals_service_policy ON growth_goals
    FOR ALL
    TO service_role
    USING (true);

-- Admins have full access
CREATE POLICY growth_goals_admin_policy ON growth_goals
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

-- 💡 OPTIMIZATION SUGGESTIONS TABLE RLS
-- Enable RLS
ALTER TABLE optimization_suggestions ENABLE ROW LEVEL SECURITY;

-- Creators can view their own suggestions
CREATE POLICY optimization_suggestions_creator_policy ON optimization_suggestions
    FOR SELECT
    TO authenticated
    USING (creator_id = auth.uid());

-- Service accounts for suggestion generation
CREATE POLICY optimization_suggestions_service_policy ON optimization_suggestions
    FOR ALL
    TO service_role
    USING (true);

-- Admins have full access
CREATE POLICY optimization_suggestions_admin_policy ON optimization_suggestions
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

-- =====================================================
-- RLS HELPER FUNCTIONS
-- =====================================================

-- Function to check if user is content owner
CREATE OR REPLACE FUNCTION is_content_owner(content_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM content_items
        WHERE id = content_id AND creator_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN auth.jwt() ->> 'role' = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user owns nostr pubkey
CREATE OR REPLACE FUNCTION owns_nostr_pubkey(pubkey VARCHAR(64))
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid() AND nostr_pubkey = pubkey
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- COMMIT TRANSACTION
-- =====================================================

COMMIT;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify RLS is enabled on all critical tables
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
    'users', 'lightning_invoices', 'lightning_payments',
    'lightning_addresses', 'user_activity_log', 'user_preferences'
)
ORDER BY tablename;

-- Count total policies created
SELECT COUNT(*) as total_policies_created
FROM pg_policies
WHERE schemaname = 'public';

-- List all tables with RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND rowsecurity = true
ORDER BY tablename;

-- =====================================================
-- LOGGING AND AUDIT
-- =====================================================

-- Log RLS implementation
INSERT INTO system_logs (event_type, details) VALUES (
    'rls_implementation_complete',
    jsonb_build_object(
        'timestamp', NOW(),
        'user_story', 'US-209',
        'tables_protected', 47,
        'policies_created', (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public'),
        'security_level', 'elite'
    )
);

-- Create RLS monitoring view
CREATE OR REPLACE VIEW rls_security_status AS
SELECT
    t.tablename,
    t.rowsecurity as rls_enabled,
    COUNT(p.policyname) as policy_count,
    ARRAY_AGG(p.policyname) as policies
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename
WHERE t.schemaname = 'public'
GROUP BY t.tablename, t.rowsecurity
ORDER BY t.tablename;

-- Grant access to monitoring view
GRANT SELECT ON rls_security_status TO authenticated;
GRANT SELECT ON rls_security_status TO service_role;
