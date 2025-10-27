-- Created file

-- =====================================================
-- 📊 ENGAGEMENT ANALYTICS DATABASE SCHEMA - ELITE TIER
-- =====================================================
--
-- Implementation for US-107 through US-110:
-- - US-107: AI-driven engagement metrics
-- - US-108: Content performance predictions
-- - US-109: Audience growth forecasting
-- - US-110: Content optimization suggestions

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Custom types for engagement analytics
CREATE TYPE timeframe_type AS ENUM (
    'hour', 'day', 'week', 'month', 'quarter', 'year'
);

CREATE TYPE optimization_priority AS ENUM (
    'critical', 'high', 'medium', 'low'
);

CREATE TYPE optimization_category AS ENUM (
    'content_structure', 'engagement_timing', 'visual_elements',
    'text_optimization', 'hashtag_strategy', 'posting_frequency',
    'audience_targeting', 'call_to_action', 'thumbnail_design',
    'title_optimization'
);

CREATE TYPE implementation_status AS ENUM (
    'pending', 'in_progress', 'implemented', 'rejected'
);

-- =====================================================
-- US-107: AI-DRIVEN ENGAGEMENT METRICS TABLES
-- =====================================================

-- Main engagement metrics storage
CREATE TABLE engagement_metrics (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    content_id UUID NOT NULL,
    creator_id UUID NOT NULL,
    timeframe timeframe_type NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Raw engagement metrics
    views BIGINT DEFAULT 0,
    likes INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    saves INTEGER DEFAULT 0,
    click_through INTEGER DEFAULT 0,
    time_spent BIGINT DEFAULT 0, -- milliseconds
    scroll_depth DECIMAL(5,2) DEFAULT 0.0, -- percentage
    return_visits INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,

    -- Calculated engagement scores (0-100)
    engagement_score DECIMAL(5,2) DEFAULT 0.0,
    quality_score DECIMAL(5,2) DEFAULT 0.0,
    viral_coefficient DECIMAL(8,4) DEFAULT 0.0,
    stickiness_factor DECIMAL(6,4) DEFAULT 0.0,

    -- AI-generated insights
    patterns_detected TEXT[] DEFAULT '{}',
    anomalies_detected TEXT[] DEFAULT '{}',
    ai_insights JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT engagement_metrics_content_timeframe_unique
        UNIQUE (content_id, timeframe, timestamp),
    CONSTRAINT engagement_metrics_valid_scores
        CHECK (engagement_score >= 0 AND engagement_score <= 100)
);

-- Engagement patterns detected by AI
CREATE TABLE engagement_patterns (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    creator_id UUID NOT NULL,
    pattern_type VARCHAR(50) NOT NULL,
    pattern_name VARCHAR(100) NOT NULL,

    -- Pattern characteristics
    metrics_involved TEXT[] NOT NULL,
    pattern_values DECIMAL(8,4)[] NOT NULL,
    timestamps TIMESTAMP WITH TIME ZONE[] NOT NULL,

    -- Pattern significance
    confidence_score DECIMAL(4,3) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    significance_level VARCHAR(20) NOT NULL DEFAULT 'medium',

    -- Pattern description and recommendations
    description TEXT NOT NULL,
    recommendations TEXT[] DEFAULT '{}',

    -- Detection metadata
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    algorithm_used VARCHAR(50) NOT NULL,
    model_version VARCHAR(20) NOT NULL,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI engagement insights
CREATE TABLE engagement_insights (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    content_id UUID,
    creator_id UUID NOT NULL,

    insight_type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,

    -- Insight scoring
    confidence_score DECIMAL(4,3) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    impact_score DECIMAL(4,2) NOT NULL CHECK (impact_score >= 0 AND impact_score <= 10),

    -- Actionability
    is_actionable BOOLEAN DEFAULT false,
    recommendations TEXT[] DEFAULT '{}',
    supporting_data JSONB DEFAULT '{}',

    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- US-108: CONTENT PERFORMANCE PREDICTIONS TABLES
-- =====================================================

-- Performance prediction models and results
CREATE TABLE performance_predictions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    content_id UUID, -- nullable for hypothetical content
    creator_id UUID NOT NULL,

    -- Content features used for prediction
    content_features JSONB NOT NULL DEFAULT '{}',

    -- Performance predictions
    predicted_views_24h BIGINT DEFAULT 0,
    predicted_views_7d BIGINT DEFAULT 0,
    predicted_engagement_rate DECIMAL(5,2) DEFAULT 0.0,
    predicted_viral_score DECIMAL(4,2) DEFAULT 0.0,
    predicted_revenue DECIMAL(12,2) DEFAULT 0.0,

    -- Confidence intervals and scores
    confidence_views_24h DECIMAL(4,3) DEFAULT 0.0,
    confidence_views_7d DECIMAL(4,3) DEFAULT 0.0,
    confidence_engagement DECIMAL(4,3) DEFAULT 0.0,
    confidence_viral DECIMAL(4,3) DEFAULT 0.0,
    confidence_revenue DECIMAL(4,3) DEFAULT 0.0,

    -- Model metadata
    model_version VARCHAR(50) NOT NULL,
    algorithm_used VARCHAR(100) NOT NULL,
    model_accuracy DECIMAL(4,3) DEFAULT 0.0,

    -- Prediction lifecycle
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Validation tracking
    is_validated BOOLEAN DEFAULT false,
    actual_results JSONB,
    validation_accuracy DECIMAL(4,3),
    validated_at TIMESTAMP WITH TIME ZONE
);

-- Content feature analysis
CREATE TABLE content_features (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    content_id UUID NOT NULL,
    creator_id UUID NOT NULL,

    -- Text features
    word_count INTEGER DEFAULT 0,
    reading_level DECIMAL(3,1) DEFAULT 0.0,
    sentiment_score DECIMAL(3,2) DEFAULT 0.0,
    hashtag_count INTEGER DEFAULT 0,

    -- Media features
    image_count INTEGER DEFAULT 0,
    video_duration BIGINT DEFAULT 0, -- seconds

    -- Structural features
    title_length INTEGER DEFAULT 0,
    description_length INTEGER DEFAULT 0,
    call_to_action_present BOOLEAN DEFAULT false,

    -- Timing features
    publish_hour INTEGER CHECK (publish_hour >= 0 AND publish_hour <= 23),
    publish_day_of_week INTEGER CHECK (publish_day_of_week >= 1 AND publish_day_of_week <= 7),

    extracted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- US-109: AUDIENCE GROWTH FORECASTING TABLES
-- =====================================================

-- Growth forecasting models and scenarios
CREATE TABLE growth_forecasts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    creator_id UUID NOT NULL,

    -- Current baseline metrics
    current_followers BIGINT NOT NULL,
    current_engagement_rate DECIMAL(5,2) NOT NULL,
    current_growth_rate DECIMAL(6,3) NOT NULL,
    current_content_frequency DECIMAL(4,2) NOT NULL, -- posts per week

    -- Forecast scenarios and timeframes
    forecast_data JSONB NOT NULL, -- structured forecast results

    -- Growth driver analysis
    growth_drivers JSONB NOT NULL DEFAULT '{}',
    growth_inhibitors JSONB NOT NULL DEFAULT '{}',

    -- Model performance
    confidence_level DECIMAL(4,3) NOT NULL,
    algorithm_used VARCHAR(100) NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    historical_accuracy DECIMAL(4,3),

    -- Forecast metadata
    forecast_horizon VARCHAR(20) NOT NULL, -- e.g., '1y', '2y'
    scenarios_count INTEGER DEFAULT 3,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Growth goals tracking
CREATE TABLE growth_goals (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    creator_id UUID NOT NULL,

    goal_type VARCHAR(50) NOT NULL, -- followers, engagement, revenue, views
    target_value BIGINT NOT NULL,
    target_date DATE NOT NULL,

    -- Progress tracking
    baseline_value BIGINT NOT NULL,
    current_progress DECIMAL(5,4) DEFAULT 0.0,
    likelihood_score DECIMAL(4,3) DEFAULT 0.5,

    -- Achievement strategy
    required_actions JSONB DEFAULT '{}',
    milestones JSONB DEFAULT '{}',

    -- Goal metadata
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    achieved_at TIMESTAMP WITH TIME ZONE,
    actual_value BIGINT
);

-- =====================================================
-- US-110: CONTENT OPTIMIZATION SUGGESTIONS TABLES
-- =====================================================

-- AI-generated optimization suggestions
CREATE TABLE optimization_suggestions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    content_id UUID NOT NULL,
    creator_id UUID NOT NULL,

    category optimization_category NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,

    -- Current vs suggested values
    current_value TEXT,
    suggested_value TEXT NOT NULL,

    -- Impact prediction
    predicted_engagement_lift DECIMAL(5,2) NOT NULL, -- percentage improvement
    prediction_confidence DECIMAL(4,3) NOT NULL,
    impact_timeframe VARCHAR(20) NOT NULL DEFAULT '7d',

    -- Suggestion priority and effort
    priority optimization_priority NOT NULL DEFAULT 'medium',
    effort_required VARCHAR(20) NOT NULL DEFAULT 'medium',

    -- Implementation guidance
    implementation_guide TEXT[] DEFAULT '{}',
    supporting_data JSONB DEFAULT '{}',

    -- A/B testing recommendations
    ab_test_recommended BOOLEAN DEFAULT false,
    ab_test_design JSONB,

    -- Tracking and status
    status implementation_status DEFAULT 'pending',
    implemented_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Optimization implementation tracking
CREATE TABLE optimization_tracking (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    suggestion_id UUID NOT NULL REFERENCES optimization_suggestions(id),

    -- Implementation details
    implementation_date TIMESTAMP WITH TIME ZONE NOT NULL,
    implementation_notes TEXT,

    -- Before/after metrics
    before_metrics JSONB NOT NULL,
    after_metrics JSONB,

    -- Results analysis
    improvement_percentage DECIMAL(6,3),
    statistical_significance DECIMAL(4,3),

    -- User feedback
    effectiveness_rating INTEGER CHECK (effectiveness_rating >= 1 AND effectiveness_rating <= 5),
    would_recommend BOOLEAN,
    feedback_comments TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- PERFORMANCE OPTIMIZATION INDEXES
-- =====================================================

-- Engagement metrics indexes
CREATE INDEX idx_engagement_metrics_content_id ON engagement_metrics(content_id);
CREATE INDEX idx_engagement_metrics_creator_id ON engagement_metrics(creator_id);
CREATE INDEX idx_engagement_metrics_timeframe ON engagement_metrics(timeframe);
CREATE INDEX idx_engagement_metrics_timestamp ON engagement_metrics(timestamp DESC);
CREATE INDEX idx_engagement_metrics_engagement_score ON engagement_metrics(engagement_score DESC);

-- Engagement patterns indexes
CREATE INDEX idx_engagement_patterns_creator_id ON engagement_patterns(creator_id);
CREATE INDEX idx_engagement_patterns_type ON engagement_patterns(pattern_type);
CREATE INDEX idx_engagement_patterns_confidence ON engagement_patterns(confidence_score DESC);

-- Performance predictions indexes
CREATE INDEX idx_performance_predictions_content_id ON performance_predictions(content_id) WHERE content_id IS NOT NULL;
CREATE INDEX idx_performance_predictions_creator_id ON performance_predictions(creator_id);
CREATE INDEX idx_performance_predictions_expires_at ON performance_predictions(expires_at);

-- Growth forecasts indexes
CREATE INDEX idx_growth_forecasts_creator_id ON growth_forecasts(creator_id);
CREATE INDEX idx_growth_forecasts_algorithm ON growth_forecasts(algorithm_used);
CREATE INDEX idx_growth_forecasts_confidence ON growth_forecasts(confidence_level DESC);

-- Optimization suggestions indexes
CREATE INDEX idx_optimization_suggestions_content_id ON optimization_suggestions(content_id);
CREATE INDEX idx_optimization_suggestions_creator_id ON optimization_suggestions(creator_id);
CREATE INDEX idx_optimization_suggestions_category ON optimization_suggestions(category);
CREATE INDEX idx_optimization_suggestions_priority ON optimization_suggestions(priority);
CREATE INDEX idx_optimization_suggestions_status ON optimization_suggestions(status);

-- =====================================================
-- STORED FUNCTIONS FOR ANALYTICS
-- =====================================================

-- Calculate engagement score
CREATE OR REPLACE FUNCTION calculate_engagement_score(
    p_views BIGINT,
    p_likes INTEGER,
    p_shares INTEGER,
    p_comments INTEGER,
    p_saves INTEGER,
    p_time_spent BIGINT,
    p_scroll_depth DECIMAL
) RETURNS DECIMAL(5,2) AS $$
DECLARE
    engagement_score DECIMAL(5,2);
    interaction_rate DECIMAL(8,4);
    time_score DECIMAL(4,2);
    scroll_score DECIMAL(4,2);
BEGIN
    -- Calculate interaction rate (interactions per view)
    IF p_views > 0 THEN
        interaction_rate := (p_likes + p_shares + p_comments + p_saves)::DECIMAL / p_views;
    ELSE
        interaction_rate := 0;
    END IF;

    -- Calculate time engagement score (normalize to 0-100)
    time_score := LEAST(p_time_spent / 1000.0 / 60.0 * 10, 100); -- 10 minutes = 100 points

    -- Calculate scroll engagement score
    scroll_score := p_scroll_depth;

    -- Weighted combination
    engagement_score := (
        interaction_rate * 100 * 0.5 +  -- 50% weight for interactions
        time_score * 0.3 +              -- 30% weight for time spent
        scroll_score * 0.2              -- 20% weight for scroll depth
    );

    RETURN LEAST(engagement_score, 100.0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Performance monitoring view
CREATE VIEW engagement_analytics_health AS
SELECT
    'engagement_metrics' as table_name,
    COUNT(*) as record_count,
    MAX(created_at) as latest_record
FROM engagement_metrics
WHERE created_at >= NOW() - INTERVAL '24 hours'
UNION ALL
SELECT
    'performance_predictions' as table_name,
    COUNT(*) as record_count,
    MAX(created_at) as latest_record
FROM performance_predictions
WHERE created_at >= NOW() - INTERVAL '24 hours'
UNION ALL
SELECT
    'optimization_suggestions' as table_name,
    COUNT(*) as record_count,
    MAX(created_at) as latest_record
FROM optimization_suggestions
WHERE created_at >= NOW() - INTERVAL '24 hours';

COMMENT ON VIEW engagement_analytics_health IS 'System health monitoring for engagement analytics';
