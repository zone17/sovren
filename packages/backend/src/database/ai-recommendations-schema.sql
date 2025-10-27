-- 🤖 AI RECOMMENDATIONS SCHEMA EXTENSION
-- Elite PostgreSQL schema for AI-powered content recommendations
-- Part of US-095 through US-098 implementation

-- Enable necessary extensions for AI/ML operations
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- 📊 USER PREFERENCES TABLE (US-095: Personalized Content Recommendations)
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Content Preferences
    preferred_content_types TEXT[] DEFAULT '{}',
    preferred_tags TEXT[] DEFAULT '{}',
    preferred_creators UUID[] DEFAULT '{}',
    preferred_difficulty_levels TEXT[] DEFAULT '{}',

    -- Behavioral Preferences (learned)
    reading_time_preference INTEGER DEFAULT 0, -- in minutes
    engagement_type_weights JSONB DEFAULT '{"like": 1.0, "comment": 2.0, "share": 3.0, "bookmark": 2.5}'::jsonb,
    content_length_preference TEXT DEFAULT 'medium', -- short, medium, long

    -- AI Learning Data
    confidence_score DECIMAL(3,2) DEFAULT 0.5 CHECK (confidence_score >= 0 AND confidence_score <= 1),
    learning_iterations INTEGER DEFAULT 0,

    -- Temporal Preferences
    preferred_publish_timeframe TEXT DEFAULT 'recent', -- recent, popular, evergreen
    seasonal_preferences JSONB DEFAULT '{}'::jsonb,

    -- Privacy Settings
    allow_behavioral_tracking BOOLEAN DEFAULT TRUE,
    allow_collaborative_filtering BOOLEAN DEFAULT TRUE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_recommendation_at TIMESTAMP WITH TIME ZONE,

    -- Constraints
    UNIQUE(user_id),

    -- Indexes for performance
    INDEX idx_user_preferences_user_id ON user_preferences(user_id),
    INDEX idx_user_preferences_content_types ON user_preferences USING GIN(preferred_content_types),
    INDEX idx_user_preferences_tags ON user_preferences USING GIN(preferred_tags),
    INDEX idx_user_preferences_creators ON user_preferences USING GIN(preferred_creators),
    INDEX idx_user_preferences_vector ON user_preferences USING ivfflat(preference_vector vector_cosine_ops)
);

-- 🎯 USER BEHAVIOR TRACKING TABLE (US-096: Behavioral Recommendations)
CREATE TABLE IF NOT EXISTS user_behavior_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES user_sessions(id) ON DELETE SET NULL,

    -- Event Details
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
        'content_view', 'content_like', 'content_unlike', 'content_comment',
        'content_share', 'content_bookmark', 'content_purchase', 'creator_follow',
        'creator_unfollow', 'search_query', 'category_browse', 'recommendation_click',
        'recommendation_dismiss', 'feedback_positive', 'feedback_negative'
    )),

    -- Content Context
    content_id UUID REFERENCES content_items(id) ON DELETE SET NULL,
    content_type VARCHAR(50),
    content_tags TEXT[],
    creator_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Behavioral Metrics
    dwell_time INTEGER DEFAULT 0, -- in seconds
    scroll_depth DECIMAL(3,2) DEFAULT 0 CHECK (scroll_depth >= 0 AND scroll_depth <= 1),
    interaction_quality DECIMAL(3,2) DEFAULT 0.5 CHECK (interaction_quality >= 0 AND interaction_quality <= 1),

    -- Context Data
    source_location VARCHAR(100), -- homepage, search, recommendation_widget, etc.
    device_type VARCHAR(20),
    referrer_url TEXT,
    search_query TEXT,

    -- AI Processing
    processed_for_ml BOOLEAN DEFAULT FALSE,
    feature_vector VECTOR(256), -- Behavioral feature embedding

    -- Timestamps
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Indexes for analytics and ML
    INDEX idx_behavior_events_user_id ON user_behavior_events(user_id),
    INDEX idx_behavior_events_content_id ON user_behavior_events(content_id),
    INDEX idx_behavior_events_type ON user_behavior_events(event_type),
    INDEX idx_behavior_events_timestamp ON user_behavior_events(timestamp DESC),
    INDEX idx_behavior_events_creator_id ON user_behavior_events(creator_id),
    INDEX idx_behavior_events_processed ON user_behavior_events(processed_for_ml),
    INDEX idx_behavior_events_composite ON user_behavior_events(user_id, event_type, timestamp DESC)
);

-- 🔗 CONTENT SIMILARITY TABLE (US-097: Content Similarity Analysis)
CREATE TABLE IF NOT EXISTS content_similarity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_a_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    content_b_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,

    -- Similarity Metrics
    overall_similarity DECIMAL(4,3) NOT NULL CHECK (overall_similarity >= 0 AND overall_similarity <= 1),
    semantic_similarity DECIMAL(4,3) DEFAULT 0 CHECK (semantic_similarity >= 0 AND semantic_similarity <= 1),
    tag_similarity DECIMAL(4,3) DEFAULT 0 CHECK (tag_similarity >= 0 AND tag_similarity <= 1),
    creator_similarity DECIMAL(4,3) DEFAULT 0 CHECK (creator_similarity >= 0 AND creator_similarity <= 1),
    engagement_similarity DECIMAL(4,3) DEFAULT 0 CHECK (engagement_similarity >= 0 AND engagement_similarity <= 1),

    -- Content Features
    content_features JSONB DEFAULT '{}'::jsonb,
    similarity_reasons TEXT[],

    -- Quality and Confidence
    confidence_score DECIMAL(3,2) DEFAULT 0.5 CHECK (confidence_score >= 0 AND confidence_score <= 1),
    calculation_method VARCHAR(50) DEFAULT 'hybrid',

    -- Timestamps
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_validated_at TIMESTAMP WITH TIME ZONE,

    -- Constraints
    UNIQUE(content_a_id, content_b_id),
    CHECK (content_a_id != content_b_id),

    -- Indexes for fast similarity lookups
    INDEX idx_content_similarity_a ON content_similarity(content_a_id, overall_similarity DESC),
    INDEX idx_content_similarity_b ON content_similarity(content_b_id, overall_similarity DESC),
    INDEX idx_content_similarity_score ON content_similarity(overall_similarity DESC),
    INDEX idx_content_similarity_calculated ON content_similarity(calculated_at DESC)
);

-- 📈 CONTENT EMBEDDINGS TABLE (for semantic similarity)
CREATE TABLE IF NOT EXISTS content_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,

    -- Embedding Data
    title_embedding VECTOR(512),
    content_embedding VECTOR(512),
    combined_embedding VECTOR(512),

    -- Metadata
    embedding_model VARCHAR(100) DEFAULT 'text-embedding-ada-002',
    embedding_version VARCHAR(20) DEFAULT '1.0',
    token_count INTEGER,

    -- Processing Status
    processing_status VARCHAR(20) DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    UNIQUE(content_id),

    -- Vector similarity indexes
    INDEX idx_content_embeddings_content_id ON content_embeddings(content_id),
    INDEX idx_content_embeddings_title ON content_embeddings USING ivfflat(title_embedding vector_cosine_ops),
    INDEX idx_content_embeddings_content ON content_embeddings USING ivfflat(content_embedding vector_cosine_ops),
    INDEX idx_content_embeddings_combined ON content_embeddings USING ivfflat(combined_embedding vector_cosine_ops),
    INDEX idx_content_embeddings_status ON content_embeddings(processing_status)
);

-- 👍 RECOMMENDATION FEEDBACK TABLE (US-098: Recommendation Feedback)
CREATE TABLE IF NOT EXISTS recommendation_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    recommendation_id UUID, -- From recommendations table

    -- Feedback Details
    feedback_type VARCHAR(20) NOT NULL CHECK (feedback_type IN ('like', 'dislike', 'not_interested', 'irrelevant', 'inappropriate', 'spam')),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),

    -- Feedback Context
    recommendation_source VARCHAR(50), -- homepage, search, similar_content, etc.
    recommendation_algorithm VARCHAR(50), -- collaborative, content_based, hybrid, etc.
    position_in_list INTEGER,

    -- User Experience
    explanation_helpful BOOLEAN,
    would_recommend_to_others BOOLEAN,
    comments TEXT,

    -- Processing
    processed_for_learning BOOLEAN DEFAULT FALSE,
    impact_on_model DECIMAL(3,2) DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    UNIQUE(user_id, content_id, recommendation_id),

    -- Indexes
    INDEX idx_recommendation_feedback_user ON recommendation_feedback(user_id),
    INDEX idx_recommendation_feedback_content ON recommendation_feedback(content_id),
    INDEX idx_recommendation_feedback_type ON recommendation_feedback(feedback_type),
    INDEX idx_recommendation_feedback_created ON recommendation_feedback(created_at DESC),
    INDEX idx_recommendation_feedback_processed ON recommendation_feedback(processed_for_learning),
    INDEX idx_recommendation_feedback_composite ON recommendation_feedback(user_id, feedback_type, created_at DESC)
);

-- 🎯 RECOMMENDATIONS TABLE (Generated recommendations storage)
CREATE TABLE IF NOT EXISTS content_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,

    -- Recommendation Scoring
    recommendation_score DECIMAL(4,3) NOT NULL CHECK (recommendation_score >= 0 AND recommendation_score <= 1),
    confidence_score DECIMAL(3,2) DEFAULT 0.5 CHECK (confidence_score >= 0 AND confidence_score <= 1),
    rank_position INTEGER NOT NULL,

    -- Algorithm Details
    algorithm_type VARCHAR(50) NOT NULL CHECK (algorithm_type IN ('collaborative', 'content_based', 'hybrid', 'behavioral', 'trending')),
    algorithm_version VARCHAR(20) DEFAULT '1.0',
    explanation TEXT,
    reasoning_factors JSONB DEFAULT '{}'::jsonb,

    -- Context
    recommendation_context VARCHAR(50), -- homepage, post_read, search_results, etc.
    session_id UUID REFERENCES user_sessions(id) ON DELETE SET NULL,

    -- Performance Tracking
    viewed BOOLEAN DEFAULT FALSE,
    clicked BOOLEAN DEFAULT FALSE,
    converted BOOLEAN DEFAULT FALSE, -- liked, shared, commented, etc.
    dismissed BOOLEAN DEFAULT FALSE,

    -- Temporal Relevance
    expires_at TIMESTAMP WITH TIME ZONE,
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Timestamps
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    viewed_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,

    -- Constraints
    UNIQUE(user_id, content_id, recommendation_context, generated_at::date),

    -- Indexes
    INDEX idx_recommendations_user_id ON content_recommendations(user_id),
    INDEX idx_recommendations_content_id ON content_recommendations(content_id),
    INDEX idx_recommendations_score ON content_recommendations(recommendation_score DESC),
    INDEX idx_recommendations_context ON content_recommendations(recommendation_context),
    INDEX idx_recommendations_algorithm ON content_recommendations(algorithm_type),
    INDEX idx_recommendations_active ON content_recommendations(user_id, expires_at) WHERE expires_at > NOW(),
    INDEX idx_recommendations_performance ON content_recommendations(user_id, clicked, converted, generated_at DESC)
);

-- 📊 RECOMMENDATION ANALYTICS TABLE
CREATE TABLE IF NOT EXISTS recommendation_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Time Dimension
    date DATE NOT NULL,
    hour INTEGER CHECK (hour >= 0 AND hour <= 23),

    -- User Dimension
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    user_cohort VARCHAR(50), -- new, returning, premium, etc.

    -- Algorithm Performance
    algorithm_type VARCHAR(50),
    total_recommendations INTEGER DEFAULT 0,
    total_views INTEGER DEFAULT 0,
    total_clicks INTEGER DEFAULT 0,
    total_conversions INTEGER DEFAULT 0,
    total_dismissals INTEGER DEFAULT 0,

    -- Metrics
    click_through_rate DECIMAL(5,4) DEFAULT 0,
    conversion_rate DECIMAL(5,4) DEFAULT 0,
    engagement_rate DECIMAL(5,4) DEFAULT 0,
    relevance_score DECIMAL(4,3) DEFAULT 0,

    -- Feedback Metrics
    positive_feedback INTEGER DEFAULT 0,
    negative_feedback INTEGER DEFAULT 0,
    feedback_rate DECIMAL(5,4) DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    UNIQUE(date, hour, user_id, algorithm_type),

    -- Indexes
    INDEX idx_recommendation_analytics_date ON recommendation_analytics(date DESC),
    INDEX idx_recommendation_analytics_user ON recommendation_analytics(user_id),
    INDEX idx_recommendation_analytics_algorithm ON recommendation_analytics(algorithm_type),
    INDEX idx_recommendation_analytics_composite ON recommendation_analytics(date, algorithm_type, click_through_rate DESC)
);

-- 🔄 FUNCTIONS FOR AI RECOMMENDATIONS

-- Function to update user preferences based on behavior
CREATE OR REPLACE FUNCTION update_user_preferences_from_behavior()
RETURNS TRIGGER AS $$
BEGIN
    -- Update user preferences when significant behavioral events occur
    IF NEW.event_type IN ('content_like', 'content_share', 'content_bookmark', 'creator_follow') THEN
        INSERT INTO user_preferences (user_id, preferred_content_types, preferred_tags, preferred_creators)
        VALUES (NEW.user_id, ARRAY[NEW.content_type], NEW.content_tags, ARRAY[NEW.creator_id])
        ON CONFLICT (user_id)
        DO UPDATE SET
            preferred_content_types = CASE
                WHEN NEW.content_type IS NOT NULL THEN
                    array_append(user_preferences.preferred_content_types, NEW.content_type)
                ELSE user_preferences.preferred_content_types
            END,
            preferred_tags = CASE
                WHEN NEW.content_tags IS NOT NULL THEN
                    user_preferences.preferred_tags || NEW.content_tags
                ELSE user_preferences.preferred_tags
            END,
            preferred_creators = CASE
                WHEN NEW.creator_id IS NOT NULL THEN
                    array_append(user_preferences.preferred_creators, NEW.creator_id)
                ELSE user_preferences.preferred_creators
            END,
            updated_at = NOW(),
            learning_iterations = user_preferences.learning_iterations + 1;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate content similarity
CREATE OR REPLACE FUNCTION calculate_content_similarity(content_a UUID, content_b UUID)
RETURNS DECIMAL(4,3) AS $$
DECLARE
    similarity_score DECIMAL(4,3) := 0;
    tag_overlap DECIMAL(4,3) := 0;
    creator_match DECIMAL(4,3) := 0;
    semantic_sim DECIMAL(4,3) := 0;
BEGIN
    -- Calculate tag-based similarity
    SELECT
        CASE
            WHEN array_length(a.tags, 1) IS NULL OR array_length(b.tags, 1) IS NULL THEN 0
            ELSE (
                SELECT COUNT(*)::DECIMAL / GREATEST(array_length(a.tags, 1), array_length(b.tags, 1))
                FROM unnest(a.tags) AS tag_a
                INNER JOIN unnest(b.tags) AS tag_b ON tag_a = tag_b
            )
        END
    INTO tag_overlap
    FROM content_items a, content_items b
    WHERE a.id = content_a AND b.id = content_b;

    -- Calculate creator similarity (same creator = 1, different = 0)
    SELECT
        CASE WHEN a.author_id = b.author_id THEN 1.0 ELSE 0.0 END
    INTO creator_match
    FROM content_items a, content_items b
    WHERE a.id = content_a AND b.id = content_b;

    -- Calculate semantic similarity using embeddings
    SELECT
        COALESCE(1 - (a.combined_embedding <=> b.combined_embedding), 0)
    INTO semantic_sim
    FROM content_embeddings a, content_embeddings b
    WHERE a.content_id = content_a AND b.content_id = content_b;

    -- Weighted combination
    similarity_score := (tag_overlap * 0.3) + (creator_match * 0.2) + (semantic_sim * 0.5);

    RETURN LEAST(similarity_score, 1.0);
END;
$$ LANGUAGE plpgsql;

-- Function to get personalized recommendations
CREATE OR REPLACE FUNCTION get_personalized_recommendations(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 10,
    p_context VARCHAR(50) DEFAULT 'homepage'
)
RETURNS TABLE(
    content_id UUID,
    recommendation_score DECIMAL(4,3),
    algorithm_type VARCHAR(50),
    explanation TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH user_prefs AS (
        SELECT * FROM user_preferences WHERE user_id = p_user_id
    ),
    content_scores AS (
        SELECT
            ci.id,
            (
                -- Tag preference matching
                CASE
                    WHEN up.preferred_tags IS NOT NULL AND array_length(up.preferred_tags, 1) > 0 THEN
                        (SELECT COUNT(*)::DECIMAL / array_length(up.preferred_tags, 1)
                         FROM unnest(ci.tags) AS tag
                         WHERE tag = ANY(up.preferred_tags))
                    ELSE 0
                END * 0.4 +

                -- Content type preference
                CASE
                    WHEN ci.content_type = ANY(up.preferred_content_types) THEN 0.3
                    ELSE 0
                END +

                -- Creator preference
                CASE
                    WHEN ci.author_id = ANY(up.preferred_creators) THEN 0.3
                    ELSE 0
                END
            ) AS score
        FROM content_items ci
        CROSS JOIN user_prefs up
        WHERE ci.status = 'published'
        AND ci.id NOT IN (
            -- Exclude already viewed content
            SELECT content_id FROM user_behavior_events
            WHERE user_id = p_user_id AND event_type = 'content_view'
            AND timestamp > NOW() - INTERVAL '30 days'
        )
    )
    SELECT
        cs.id,
        LEAST(cs.score, 1.0)::DECIMAL(4,3),
        'content_based'::VARCHAR(50),
        'Based on your preferences and past interactions'::TEXT
    FROM content_scores cs
    WHERE cs.score > 0.1
    ORDER BY cs.score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER trigger_update_preferences_from_behavior
    AFTER INSERT ON user_behavior_events
    FOR EACH ROW
    EXECUTE FUNCTION update_user_preferences_from_behavior();

-- Create indexes for performance optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_behavior_events_ml_processing
    ON user_behavior_events(processed_for_ml, timestamp DESC)
    WHERE processed_for_ml = FALSE;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_recommendations_active_user
    ON content_recommendations(user_id, expires_at DESC)
    WHERE expires_at > NOW();

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recommendation_feedback_learning
    ON recommendation_feedback(processed_for_learning, created_at DESC)
    WHERE processed_for_learning = FALSE;

-- Cleanup functions for maintenance
CREATE OR REPLACE FUNCTION cleanup_old_recommendations()
RETURNS void AS $$
BEGIN
    -- Remove expired recommendations older than 7 days
    DELETE FROM content_recommendations
    WHERE expires_at < NOW() - INTERVAL '7 days';

    -- Remove old behavior events older than 90 days (keep for learning)
    DELETE FROM user_behavior_events
    WHERE timestamp < NOW() - INTERVAL '90 days';

    -- Archive old analytics data older than 1 year
    DELETE FROM recommendation_analytics
    WHERE date < NOW() - INTERVAL '1 year';
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO postgres;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- Comments for documentation
COMMENT ON TABLE user_preferences IS 'US-095: Stores user content preferences for personalized recommendations';
COMMENT ON TABLE user_behavior_events IS 'US-096: Tracks user behavior for behavioral recommendations';
COMMENT ON TABLE content_similarity IS 'US-097: Stores calculated content similarity scores';
COMMENT ON TABLE recommendation_feedback IS 'US-098: Stores user feedback on recommendations for system improvement';
COMMENT ON TABLE content_recommendations IS 'Generated content recommendations with scoring and context';
COMMENT ON TABLE recommendation_analytics IS 'Analytics data for recommendation system performance monitoring';
COMMENT ON TABLE content_embeddings IS 'Vector embeddings for semantic content similarity analysis';
