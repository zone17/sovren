-- 🎭 CREATOR RECOMMENDATIONS SCHEMA EXTENSION
-- Elite PostgreSQL schema for AI-powered creator recommendations
-- Part of US-099 through US-102 implementation

-- Enable necessary extensions for creator recommendation operations
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS vector;

-- 👤 CREATOR PROFILES TABLE (US-099: Creator Matching Based on Interests)
CREATE TABLE IF NOT EXISTS creator_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Profile Information
    bio TEXT,
    expertise_areas TEXT[] DEFAULT '{}',
    content_categories TEXT[] DEFAULT '{}',
    primary_topics TEXT[] DEFAULT '{}',

    -- Creator Characteristics
    content_style VARCHAR(50) DEFAULT 'mixed', -- educational, entertainment, informational, inspirational, mixed
    audience_level VARCHAR(30) DEFAULT 'intermediate', -- beginner, intermediate, advanced, expert
    posting_frequency VARCHAR(20) DEFAULT 'weekly', -- daily, weekly, biweekly, monthly, irregular

    -- Engagement Metrics
    avg_content_quality DECIMAL(3,2) DEFAULT 0.0 CHECK (avg_content_quality >= 0 AND avg_content_quality <= 5),
    community_engagement_score DECIMAL(4,3) DEFAULT 0.0 CHECK (community_engagement_score >= 0 AND community_engagement_score <= 1),
    follower_growth_rate DECIMAL(5,4) DEFAULT 0.0,

    -- Creator Embeddings for Similarity Matching
    profile_embedding VECTOR(512),
    content_style_embedding VECTOR(256),
    topic_embedding VECTOR(512),

    -- Social Network Analysis
    collaboration_network JSONB DEFAULT '{}'::jsonb,
    influence_score DECIMAL(4,3) DEFAULT 0.0 CHECK (influence_score >= 0 AND influence_score <= 1),

    -- Creator Activity Patterns
    active_hours JSONB DEFAULT '{}'::jsonb, -- {hour: activity_level}
    active_days JSONB DEFAULT '{}'::jsonb, -- {day: activity_level}
    content_publishing_pattern JSONB DEFAULT '{}'::jsonb,

    -- Verification and Trust
    verification_status VARCHAR(20) DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'verified', 'featured', 'sponsored')),
    trust_score DECIMAL(3,2) DEFAULT 0.5 CHECK (trust_score >= 0 AND trust_score <= 1),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_analyzed_at TIMESTAMP WITH TIME ZONE,

    -- Constraints
    UNIQUE(creator_id),

    -- Indexes for performance
    INDEX idx_creator_profiles_creator_id ON creator_profiles(creator_id),
    INDEX idx_creator_profiles_categories ON creator_profiles USING GIN(content_categories),
    INDEX idx_creator_profiles_topics ON creator_profiles USING GIN(primary_topics),
    INDEX idx_creator_profiles_expertise ON creator_profiles USING GIN(expertise_areas),
    INDEX idx_creator_profiles_embedding ON creator_profiles USING ivfflat(profile_embedding vector_cosine_ops),
    INDEX idx_creator_profiles_style_embedding ON creator_profiles USING ivfflat(content_style_embedding vector_cosine_ops),
    INDEX idx_creator_profiles_topic_embedding ON creator_profiles USING ivfflat(topic_embedding vector_cosine_ops),
    INDEX idx_creator_profiles_quality ON creator_profiles(avg_content_quality DESC),
    INDEX idx_creator_profiles_engagement ON creator_profiles(community_engagement_score DESC),
    INDEX idx_creator_profiles_verification ON creator_profiles(verification_status, trust_score DESC)
);

-- 🏷️ INTEREST TAXONOMY TABLE (US-100: Interest-based Creator Suggestions)
CREATE TABLE IF NOT EXISTS interest_taxonomy (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Taxonomy Structure
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    parent_id UUID REFERENCES interest_taxonomy(id) ON DELETE SET NULL,
    level INTEGER DEFAULT 0 CHECK (level >= 0 AND level <= 5),
    path TEXT, -- Materialized path for efficient queries

    -- Interest Characteristics
    category VARCHAR(50), -- technology, arts, business, science, lifestyle, etc.
    keywords TEXT[] DEFAULT '{}',
    synonyms TEXT[] DEFAULT '{}',
    related_interests UUID[] DEFAULT '{}',

    -- Machine Learning Features
    interest_embedding VECTOR(256),
    semantic_cluster_id UUID,

    -- Popularity and Trends
    follower_count INTEGER DEFAULT 0,
    content_count INTEGER DEFAULT 0,
    engagement_score DECIMAL(4,3) DEFAULT 0.0,
    trending_score DECIMAL(4,3) DEFAULT 0.0,

    -- Metadata
    is_active BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Indexes for hierarchical and semantic queries
    INDEX idx_interest_taxonomy_parent ON interest_taxonomy(parent_id),
    INDEX idx_interest_taxonomy_path ON interest_taxonomy USING GIN(to_tsvector('english', path)),
    INDEX idx_interest_taxonomy_keywords ON interest_taxonomy USING GIN(keywords),
    INDEX idx_interest_taxonomy_embedding ON interest_taxonomy USING ivfflat(interest_embedding vector_cosine_ops),
    INDEX idx_interest_taxonomy_trending ON interest_taxonomy(trending_score DESC, engagement_score DESC),
    INDEX idx_interest_taxonomy_category ON interest_taxonomy(category, is_active),
    INDEX idx_interest_taxonomy_active ON interest_taxonomy(is_active, is_featured, display_order)
);

-- 🔗 USER INTEREST MAPPING TABLE (US-100: Interest-based Creator Suggestions)
CREATE TABLE IF NOT EXISTS user_interest_mapping (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    interest_id UUID NOT NULL REFERENCES interest_taxonomy(id) ON DELETE CASCADE,

    -- Interest Strength and Source
    interest_strength DECIMAL(3,2) DEFAULT 0.5 CHECK (interest_strength >= 0 AND interest_strength <= 1),
    confidence_score DECIMAL(3,2) DEFAULT 0.5 CHECK (confidence_score >= 0 AND confidence_score <= 1),
    source VARCHAR(30) NOT NULL CHECK (source IN ('explicit', 'behavioral', 'inferred', 'collaborative')),

    -- Learning and Adaptation
    learning_iterations INTEGER DEFAULT 0,
    last_engagement_at TIMESTAMP WITH TIME ZONE,
    engagement_count INTEGER DEFAULT 0,

    -- Temporal Dynamics
    interest_decay_rate DECIMAL(4,3) DEFAULT 0.1 CHECK (interest_decay_rate >= 0 AND interest_decay_rate <= 1),
    seasonal_variance JSONB DEFAULT '{}'::jsonb,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    UNIQUE(user_id, interest_id),

    -- Indexes for recommendation queries
    INDEX idx_user_interest_mapping_user ON user_interest_mapping(user_id, interest_strength DESC),
    INDEX idx_user_interest_mapping_interest ON user_interest_mapping(interest_id, interest_strength DESC),
    INDEX idx_user_interest_mapping_strength ON user_interest_mapping(interest_strength DESC),
    INDEX idx_user_interest_mapping_source ON user_interest_mapping(source, confidence_score DESC),
    INDEX idx_user_interest_mapping_recent ON user_interest_mapping(last_engagement_at DESC)
);

-- 🎯 CREATOR INTEREST MAPPING TABLE (US-100: Interest-based Creator Suggestions)
CREATE TABLE IF NOT EXISTS creator_interest_mapping (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    interest_id UUID NOT NULL REFERENCES interest_taxonomy(id) ON DELETE CASCADE,

    -- Creator-Interest Relationship
    expertise_level DECIMAL(3,2) DEFAULT 0.5 CHECK (expertise_level >= 0 AND expertise_level <= 1),
    content_volume_score DECIMAL(3,2) DEFAULT 0.0 CHECK (content_volume_score >= 0 AND content_volume_score <= 1),
    audience_alignment_score DECIMAL(3,2) DEFAULT 0.0 CHECK (audience_alignment_score >= 0 AND audience_alignment_score <= 1),

    -- Performance Metrics
    engagement_rate DECIMAL(4,3) DEFAULT 0.0,
    content_quality_score DECIMAL(3,2) DEFAULT 0.0,
    follower_interest_overlap DECIMAL(3,2) DEFAULT 0.0,

    -- Content Analysis
    primary_content_type VARCHAR(50), -- article, video, podcast, course, etc.
    content_frequency INTEGER DEFAULT 0, -- posts per month
    last_content_published_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    UNIQUE(creator_id, interest_id),

    -- Indexes for creator discovery
    INDEX idx_creator_interest_mapping_creator ON creator_interest_mapping(creator_id, expertise_level DESC),
    INDEX idx_creator_interest_mapping_interest ON creator_interest_mapping(interest_id, expertise_level DESC, audience_alignment_score DESC),
    INDEX idx_creator_interest_mapping_expertise ON creator_interest_mapping(expertise_level DESC, engagement_rate DESC),
    INDEX idx_creator_interest_mapping_content_type ON creator_interest_mapping(primary_content_type, content_frequency DESC)
);

-- 🔍 CREATOR DISCOVERY SESSIONS TABLE (US-101: Discovery Interface for New Creators)
CREATE TABLE IF NOT EXISTS creator_discovery_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Session Details
    session_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    session_end TIMESTAMP WITH TIME ZONE,
    discovery_method VARCHAR(50) NOT NULL CHECK (discovery_method IN ('browse', 'search', 'recommendations', 'trending', 'categories', 'random')),

    -- Discovery Context
    search_query TEXT,
    selected_categories TEXT[],
    filters_applied JSONB DEFAULT '{}'::jsonb,

    -- Session Metrics
    creators_viewed INTEGER DEFAULT 0,
    creators_clicked INTEGER DEFAULT 0,
    creators_followed INTEGER DEFAULT 0,
    time_spent_seconds INTEGER DEFAULT 0,

    -- Personalization Data
    personalization_algorithm VARCHAR(50),
    recommendation_confidence DECIMAL(3,2) DEFAULT 0.5,
    diversity_score DECIMAL(3,2) DEFAULT 0.5,

    -- User Feedback
    session_satisfaction INTEGER CHECK (session_satisfaction >= 1 AND session_satisfaction <= 5),
    feedback_comments TEXT,

    -- Device and Context
    device_type VARCHAR(20),
    platform VARCHAR(20),
    referrer_source VARCHAR(100),

    -- Timestamps
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Indexes for analytics
    INDEX idx_creator_discovery_sessions_user ON creator_discovery_sessions(user_id, session_start DESC),
    INDEX idx_creator_discovery_sessions_method ON creator_discovery_sessions(discovery_method, session_start DESC),
    INDEX idx_creator_discovery_sessions_satisfaction ON creator_discovery_sessions(session_satisfaction, creators_followed DESC),
    INDEX idx_creator_discovery_sessions_timeframe ON creator_discovery_sessions(session_start DESC)
);

-- 👥 CREATOR RECOMMENDATIONS TABLE (US-102: Follow Recommendations)
CREATE TABLE IF NOT EXISTS creator_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recommended_creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Recommendation Algorithm and Scoring
    algorithm_used VARCHAR(50) NOT NULL CHECK (algorithm_used IN ('collaborative_filtering', 'content_based', 'social_network', 'hybrid', 'trending', 'onboarding')),
    recommendation_score DECIMAL(4,3) NOT NULL CHECK (recommendation_score >= 0 AND recommendation_score <= 1),
    confidence_level DECIMAL(3,2) DEFAULT 0.5 CHECK (confidence_level >= 0 AND confidence_level <= 1),

    -- Recommendation Reasons
    primary_reason VARCHAR(100),
    secondary_reasons TEXT[],
    explanation_factors JSONB DEFAULT '{}'::jsonb,

    -- Interest and Topic Alignment
    shared_interests UUID[],
    topic_similarity_score DECIMAL(3,2) DEFAULT 0.0,
    content_style_match DECIMAL(3,2) DEFAULT 0.0,

    -- Social Network Factors
    mutual_connections INTEGER DEFAULT 0,
    social_distance INTEGER DEFAULT 0, -- degrees of separation
    network_influence_score DECIMAL(3,2) DEFAULT 0.0,

    -- Timing and Context
    recommendation_context VARCHAR(50), -- onboarding, homepage, search, profile_view, etc.
    optimal_presentation_time TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,

    -- User Interaction Tracking
    presented_at TIMESTAMP WITH TIME ZONE,
    viewed_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    followed_at TIMESTAMP WITH TIME ZONE,
    dismissed_at TIMESTAMP WITH TIME ZONE,

    -- Performance Metrics
    position_in_list INTEGER,
    click_through_rate DECIMAL(4,3) DEFAULT 0.0,
    conversion_rate DECIMAL(4,3) DEFAULT 0.0,

    -- A/B Testing
    experiment_id VARCHAR(50),
    control_group BOOLEAN DEFAULT FALSE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    UNIQUE(user_id, recommended_creator_id, created_at),
    CHECK (user_id != recommended_creator_id),

    -- Indexes for recommendation serving and analytics
    INDEX idx_creator_recommendations_user ON creator_recommendations(user_id, recommendation_score DESC, created_at DESC),
    INDEX idx_creator_recommendations_creator ON creator_recommendations(recommended_creator_id, recommendation_score DESC),
    INDEX idx_creator_recommendations_active ON creator_recommendations(user_id, expires_at, presented_at) WHERE expires_at > NOW(),
    INDEX idx_creator_recommendations_algorithm ON creator_recommendations(algorithm_used, recommendation_score DESC),
    INDEX idx_creator_recommendations_performance ON creator_recommendations(click_through_rate DESC, conversion_rate DESC),
    INDEX idx_creator_recommendations_timing ON creator_recommendations(optimal_presentation_time, recommendation_context),
    INDEX idx_creator_recommendations_social ON creator_recommendations(mutual_connections DESC, social_distance ASC)
);

-- 📊 FOLLOW RELATIONSHIP TRACKING TABLE (US-102: Follow Recommendations)
CREATE TABLE IF NOT EXISTS follow_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Follow Details
    followed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    follow_source VARCHAR(50), -- recommendation, search, profile_visit, discovery, manual
    recommendation_id UUID REFERENCES creator_recommendations(id) ON DELETE SET NULL,

    -- Relationship Metrics
    engagement_score DECIMAL(3,2) DEFAULT 0.0 CHECK (engagement_score >= 0 AND engagement_score <= 1),
    interaction_frequency DECIMAL(3,2) DEFAULT 0.0,
    content_consumption_rate DECIMAL(3,2) DEFAULT 0.0,

    -- Follow Success Indicators
    days_remained_followed INTEGER DEFAULT 0,
    unfollowed_at TIMESTAMP WITH TIME ZONE,
    unfollow_reason VARCHAR(50),

    -- Network Effect Tracking
    influenced_additional_follows INTEGER DEFAULT 0,
    recommendation_success_score DECIMAL(3,2) DEFAULT 0.0,

    -- Timestamps
    last_interaction_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    UNIQUE(follower_id, following_id),
    CHECK (follower_id != following_id),

    -- Indexes for social network analysis
    INDEX idx_follow_relationships_follower ON follow_relationships(follower_id, followed_at DESC),
    INDEX idx_follow_relationships_following ON follow_relationships(following_id, followed_at DESC),
    INDEX idx_follow_relationships_source ON follow_relationships(follow_source, recommendation_id),
    INDEX idx_follow_relationships_active ON follow_relationships(follower_id, following_id) WHERE unfollowed_at IS NULL,
    INDEX idx_follow_relationships_engagement ON follow_relationships(engagement_score DESC, interaction_frequency DESC),
    INDEX idx_follow_relationships_success ON follow_relationships(recommendation_success_score DESC, days_remained_followed DESC)
);

-- 🎨 CREATOR SIMILARITY MATRIX TABLE (US-099: Creator Matching)
CREATE TABLE IF NOT EXISTS creator_similarity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_a_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    creator_b_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Similarity Scores
    overall_similarity DECIMAL(4,3) NOT NULL CHECK (overall_similarity >= 0 AND overall_similarity <= 1),
    content_similarity DECIMAL(4,3) DEFAULT 0.0 CHECK (content_similarity >= 0 AND content_similarity <= 1),
    style_similarity DECIMAL(4,3) DEFAULT 0.0 CHECK (style_similarity >= 0 AND style_similarity <= 1),
    audience_similarity DECIMAL(4,3) DEFAULT 0.0 CHECK (audience_similarity >= 0 AND audience_similarity <= 1),
    topic_similarity DECIMAL(4,3) DEFAULT 0.0 CHECK (topic_similarity >= 0 AND topic_similarity <= 1),
    engagement_pattern_similarity DECIMAL(4,3) DEFAULT 0.0 CHECK (engagement_pattern_similarity >= 0 AND engagement_pattern_similarity <= 1),

    -- Similarity Explanations
    similarity_factors TEXT[],
    shared_topics TEXT[],
    shared_audience_interests TEXT[],

    -- Machine Learning Features
    feature_vector_distance DECIMAL(6,5),
    embedding_cosine_similarity DECIMAL(4,3),

    -- Calculation Metadata
    calculation_method VARCHAR(50) DEFAULT 'hybrid',
    confidence_score DECIMAL(3,2) DEFAULT 0.5,
    calculation_version VARCHAR(10) DEFAULT '1.0',

    -- Timestamps
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    UNIQUE(creator_a_id, creator_b_id),
    CHECK (creator_a_id != creator_b_id),

    -- Indexes for similarity queries
    INDEX idx_creator_similarity_a ON creator_similarity(creator_a_id, overall_similarity DESC),
    INDEX idx_creator_similarity_b ON creator_similarity(creator_b_id, overall_similarity DESC),
    INDEX idx_creator_similarity_score ON creator_similarity(overall_similarity DESC),
    INDEX idx_creator_similarity_updated ON creator_similarity(last_updated_at DESC)
);

-- 📈 CREATOR RECOMMENDATION ANALYTICS TABLE
CREATE TABLE IF NOT EXISTS creator_recommendation_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Time Period
    date_period DATE NOT NULL,
    hour_period INTEGER CHECK (hour_period >= 0 AND hour_period <= 23),

    -- Algorithm Performance
    algorithm_name VARCHAR(50) NOT NULL,
    total_recommendations INTEGER DEFAULT 0,
    total_presentations INTEGER DEFAULT 0,
    total_clicks INTEGER DEFAULT 0,
    total_follows INTEGER DEFAULT 0,

    -- Success Metrics
    click_through_rate DECIMAL(5,4) DEFAULT 0.0,
    follow_conversion_rate DECIMAL(5,4) DEFAULT 0.0,
    average_recommendation_score DECIMAL(4,3) DEFAULT 0.0,

    -- User Engagement
    unique_users_served INTEGER DEFAULT 0,
    avg_recommendations_per_user DECIMAL(4,2) DEFAULT 0.0,
    user_satisfaction_score DECIMAL(3,2) DEFAULT 0.0,

    -- Creator Impact
    unique_creators_recommended INTEGER DEFAULT 0,
    new_creators_discovered INTEGER DEFAULT 0,
    creators_with_successful_recommendations INTEGER DEFAULT 0,

    -- Quality Metrics
    diversity_score DECIMAL(3,2) DEFAULT 0.0,
    novelty_score DECIMAL(3,2) DEFAULT 0.0,
    relevance_score DECIMAL(3,2) DEFAULT 0.0,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    UNIQUE(date_period, hour_period, algorithm_name),

    -- Indexes for analytics queries
    INDEX idx_creator_rec_analytics_date ON creator_recommendation_analytics(date_period DESC, hour_period DESC),
    INDEX idx_creator_rec_analytics_algorithm ON creator_recommendation_analytics(algorithm_name, date_period DESC),
    INDEX idx_creator_rec_analytics_performance ON creator_recommendation_analytics(follow_conversion_rate DESC, click_through_rate DESC)
);

-- 🔧 DATABASE FUNCTIONS FOR CREATOR RECOMMENDATIONS

-- Function to calculate creator similarity scores
CREATE OR REPLACE FUNCTION calculate_creator_similarity(creator_a UUID, creator_b UUID)
RETURNS DECIMAL(4,3) AS $$
DECLARE
    content_sim DECIMAL(4,3) := 0.0;
    style_sim DECIMAL(4,3) := 0.0;
    audience_sim DECIMAL(4,3) := 0.0;
    topic_sim DECIMAL(4,3) := 0.0;
    engagement_sim DECIMAL(4,3) := 0.0;
    overall_sim DECIMAL(4,3);
BEGIN
    -- Calculate topic similarity
    SELECT
        COALESCE(
            ARRAY_LENGTH(
                ARRAY(
                    SELECT UNNEST(cp1.primary_topics)
                    INTERSECT
                    SELECT UNNEST(cp2.primary_topics)
                ), 1
            ) / GREATEST(
                ARRAY_LENGTH(cp1.primary_topics, 1),
                ARRAY_LENGTH(cp2.primary_topics, 1),
                1
            ), 0.0
        )
    INTO topic_sim
    FROM creator_profiles cp1, creator_profiles cp2
    WHERE cp1.creator_id = creator_a AND cp2.creator_id = creator_b;

    -- Calculate style similarity
    SELECT
        CASE
            WHEN cp1.content_style = cp2.content_style AND cp1.audience_level = cp2.audience_level THEN 1.0
            WHEN cp1.content_style = cp2.content_style OR cp1.audience_level = cp2.audience_level THEN 0.7
            ELSE 0.3
        END
    INTO style_sim
    FROM creator_profiles cp1, creator_profiles cp2
    WHERE cp1.creator_id = creator_a AND cp2.creator_id = creator_b;

    -- Calculate engagement pattern similarity
    SELECT
        1.0 - ABS(
            COALESCE(cp1.community_engagement_score, 0) -
            COALESCE(cp2.community_engagement_score, 0)
        )
    INTO engagement_sim
    FROM creator_profiles cp1, creator_profiles cp2
    WHERE cp1.creator_id = creator_a AND cp2.creator_id = creator_b;

    -- Calculate overall similarity with weighted average
    overall_sim := (
        topic_sim * 0.4 +
        style_sim * 0.3 +
        engagement_sim * 0.3
    );

    -- Store the calculated similarity
    INSERT INTO creator_similarity (
        creator_a_id, creator_b_id, overall_similarity,
        content_similarity, style_similarity,
        topic_similarity, engagement_pattern_similarity,
        calculation_method, confidence_score
    ) VALUES (
        creator_a, creator_b, overall_sim,
        topic_sim, style_sim,
        topic_sim, engagement_sim,
        'algorithmic', 0.85
    ) ON CONFLICT (creator_a_id, creator_b_id)
    DO UPDATE SET
        overall_similarity = EXCLUDED.overall_similarity,
        content_similarity = EXCLUDED.content_similarity,
        style_similarity = EXCLUDED.style_similarity,
        topic_similarity = EXCLUDED.topic_similarity,
        engagement_pattern_similarity = EXCLUDED.engagement_pattern_similarity,
        last_updated_at = NOW();

    RETURN overall_sim;
END;
$$ LANGUAGE plpgsql;

-- Function to generate creator recommendations for a user
CREATE OR REPLACE FUNCTION get_creator_recommendations(
    target_user UUID,
    algorithm VARCHAR(50) DEFAULT 'hybrid',
    max_recommendations INTEGER DEFAULT 10,
    min_score DECIMAL(3,2) DEFAULT 0.3
)
RETURNS TABLE (
    recommended_creator_id UUID,
    recommendation_score DECIMAL(4,3),
    primary_reason VARCHAR(100),
    shared_interests TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    WITH user_interests AS (
        SELECT uim.interest_id, uim.interest_strength
        FROM user_interest_mapping uim
        WHERE uim.user_id = target_user
          AND uim.interest_strength > 0.2
    ),
    creator_matches AS (
        SELECT
            cim.creator_id,
            AVG(cim.expertise_level * ui.interest_strength) as interest_match_score,
            ARRAY_AGG(DISTINCT it.name ORDER BY cim.expertise_level DESC) as matched_interests,
            COUNT(DISTINCT cim.interest_id) as shared_interest_count
        FROM creator_interest_mapping cim
        JOIN user_interests ui ON ui.interest_id = cim.interest_id
        JOIN interest_taxonomy it ON it.id = cim.interest_id
        WHERE cim.creator_id != target_user
          AND cim.expertise_level > 0.3
        GROUP BY cim.creator_id
        HAVING COUNT(DISTINCT cim.interest_id) >= 1
    )
    SELECT
        cm.creator_id,
        cm.interest_match_score,
        CASE
            WHEN cm.shared_interest_count > 3 THEN 'Strong interest alignment'
            ELSE 'Shared interests in ' || cm.matched_interests[1]
        END as reason,
        cm.matched_interests
    FROM creator_matches cm
    WHERE cm.interest_match_score >= min_score
    ORDER BY cm.interest_match_score DESC
    LIMIT max_recommendations;
END;
$$ LANGUAGE plpgsql;

-- Function to update creator profiles from content analysis
CREATE OR REPLACE FUNCTION update_creator_profile_from_content()
RETURNS TRIGGER AS $$
BEGIN
    -- Update creator profile metrics when new content is published
    UPDATE creator_profiles
    SET
        updated_at = NOW(),
        last_analyzed_at = NOW()
    WHERE creator_id = NEW.creator_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to process follow events for recommendation analytics
CREATE OR REPLACE FUNCTION process_follow_recommendation_success()
RETURNS TRIGGER AS $$
BEGIN
    -- Update recommendation success metrics
    UPDATE creator_recommendations
    SET
        followed_at = NEW.followed_at,
        conversion_rate = 1.0
    WHERE id = NEW.recommendation_id;

    -- Update follow relationship tracking
    UPDATE follow_relationships
    SET
        recommendation_success_score = 1.0,
        updated_at = NOW()
    WHERE follower_id = NEW.follower_id
      AND following_id = NEW.following_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 🚀 TRIGGERS

-- Trigger to update creator profiles when content is published
CREATE TRIGGER trigger_update_creator_profile_from_content
    AFTER INSERT OR UPDATE ON content_items
    FOR EACH ROW
    EXECUTE FUNCTION update_creator_profile_from_content();

-- Trigger to process recommendation success tracking
CREATE TRIGGER trigger_process_follow_recommendation_success
    AFTER INSERT ON follow_relationships
    FOR EACH ROW
    WHEN (NEW.recommendation_id IS NOT NULL)
    EXECUTE FUNCTION process_follow_recommendation_success();

-- 📊 ADDITIONAL INDEXES FOR PERFORMANCE

-- Composite indexes for creator recommendation queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creator_recommendations_user_algorithm_score
    ON creator_recommendations(user_id, algorithm_used, recommendation_score DESC, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_interest_mapping_strength_confidence
    ON user_interest_mapping(user_id, interest_strength DESC, confidence_score DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creator_interest_mapping_expertise_engagement
    ON creator_interest_mapping(interest_id, expertise_level DESC, engagement_rate DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follow_relationships_active_engagment
    ON follow_relationships(follower_id, engagement_score DESC) WHERE unfollowed_at IS NULL;

-- Partial indexes for active recommendations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creator_recommendations_active_high_score
    ON creator_recommendations(user_id, recommendation_score DESC)
    WHERE expires_at > NOW() AND recommendation_score > 0.5;

-- 🧹 CLEANUP FUNCTIONS

-- Function to cleanup expired recommendations
CREATE OR REPLACE FUNCTION cleanup_expired_creator_recommendations()
RETURNS void AS $$
BEGIN
    DELETE FROM creator_recommendations
    WHERE expires_at < NOW() - INTERVAL '30 days';

    DELETE FROM creator_discovery_sessions
    WHERE session_start < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-creator-recommendations', '0 2 * * *', 'SELECT cleanup_expired_creator_recommendations();');

-- 🎯 PERFORMANCE OPTIMIZATION

-- Analyze tables for query optimization
ANALYZE creator_profiles;
ANALYZE interest_taxonomy;
ANALYZE user_interest_mapping;
ANALYZE creator_interest_mapping;
ANALYZE creator_recommendations;
ANALYZE follow_relationships;
ANALYZE creator_similarity;

-- Update table statistics
UPDATE pg_stat_user_tables SET n_tup_upd = n_tup_upd + 1 WHERE relname LIKE 'creator_%';
