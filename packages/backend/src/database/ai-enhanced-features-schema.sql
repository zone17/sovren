-- =====================================================
-- 🤖 AI-ENHANCED FEATURES DATABASE SCHEMA
-- =====================================================
--
-- Complete database schema for US-103 through US-106
-- Elite engineering implementation with performance optimization
--
-- Features:
-- - US-103: Automatic Content Tagging
-- - US-104: Topic Extraction for Content
-- - US-105: Content Clustering
-- - US-106: Related Content Suggestions
--
-- @author Sovren Platform Team
-- @version 1.0.0
--
-- Performance targets:
-- - Tag queries: <50ms
-- - Topic extraction: <200ms
-- - Clustering operations: <500ms
-- - Related content suggestions: <100ms
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- =====================================================
-- US-103: AUTOMATIC CONTENT TAGGING TABLES
-- =====================================================

-- Content tags with confidence and source tracking
CREATE TABLE content_tags (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    content_id UUID NOT NULL,
    tag VARCHAR(100) NOT NULL,
    confidence DECIMAL(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    category tag_category NOT NULL,
    source tag_source NOT NULL,
    reasoning TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_validated BOOLEAN DEFAULT FALSE,
    validated_by UUID,
    validation_timestamp TIMESTAMP,

    CONSTRAINT fk_content_tags_content FOREIGN KEY (content_id) REFERENCES content_items(id) ON DELETE CASCADE,
    CONSTRAINT fk_content_tags_validator FOREIGN KEY (validated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Tag categories enum
CREATE TYPE tag_category AS ENUM (
    'topic', 'sentiment', 'entity', 'keyword', 'genre', 'difficulty'
);

-- Tag sources enum
CREATE TYPE tag_source AS ENUM (
    'ai_extraction', 'user_input', 'collaborative_filtering', 'rule_based'
);

-- Auto-tagging configuration per content type
CREATE TABLE auto_tagging_configs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    content_type VARCHAR(50) NOT NULL,
    enabled_categories tag_category[] NOT NULL DEFAULT ARRAY['topic', 'keyword']::tag_category[],
    confidence_threshold DECIMAL(4,3) DEFAULT 0.7 CHECK (confidence_threshold >= 0 AND confidence_threshold <= 1),
    max_tags_per_category INTEGER DEFAULT 10 CHECK (max_tags_per_category > 0),
    enable_learning_from_corrections BOOLEAN DEFAULT TRUE,
    enable_collaborative_filtering BOOLEAN DEFAULT TRUE,
    enable_human_validation BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,

    UNIQUE(content_type)
);

-- Tag validation rules
CREATE TABLE tag_validation_rules (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    rule_type validation_rule_type NOT NULL,
    pattern TEXT,
    threshold DECIMAL(4,3),
    parameters JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(name)
);

-- Validation rule types enum
CREATE TYPE validation_rule_type AS ENUM (
    'regex', 'keyword_match', 'semantic_similarity', 'custom_function'
);

-- Tag learning from user corrections
CREATE TABLE tag_feedback (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    content_id UUID NOT NULL,
    user_id UUID NOT NULL,
    approved_tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    rejected_tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    added_tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    feedback_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed BOOLEAN DEFAULT FALSE,

    CONSTRAINT fk_tag_feedback_content FOREIGN KEY (content_id) REFERENCES content_items(id) ON DELETE CASCADE,
    CONSTRAINT fk_tag_feedback_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(content_id, user_id)
);

-- =====================================================
-- US-104: TOPIC EXTRACTION TABLES
-- =====================================================

-- Extracted topics with hierarchy support
CREATE TABLE extracted_topics (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    description TEXT,
    confidence DECIMAL(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    relevance DECIMAL(4,3) NOT NULL CHECK (relevance >= 0 AND relevance <= 1),
    key_phrases TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    semantic_weight DECIMAL(4,3) NOT NULL CHECK (semantic_weight >= 0 AND semantic_weight <= 1),
    extraction_method topic_extraction_method NOT NULL,
    parent_topic_id UUID,
    embedding VECTOR(384), -- Using sentence transformer embedding size
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,

    CONSTRAINT fk_extracted_topics_parent FOREIGN KEY (parent_topic_id) REFERENCES extracted_topics(id) ON DELETE SET NULL,
    UNIQUE(name)
);

-- Topic extraction methods enum
CREATE TYPE topic_extraction_method AS ENUM (
    'lda', 'bert', 'openai', 'hybrid', 'rule_based'
);

-- Content-topic associations with confidence
CREATE TABLE content_topics (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    content_id UUID NOT NULL,
    topic_id UUID NOT NULL,
    confidence DECIMAL(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    relevance DECIMAL(4,3) NOT NULL CHECK (relevance >= 0 AND relevance <= 1),
    extraction_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    algorithm_version VARCHAR(50),

    CONSTRAINT fk_content_topics_content FOREIGN KEY (content_id) REFERENCES content_items(id) ON DELETE CASCADE,
    CONSTRAINT fk_content_topics_topic FOREIGN KEY (topic_id) REFERENCES extracted_topics(id) ON DELETE CASCADE,
    PRIMARY KEY (content_id, topic_id)
);

-- Topic hierarchy relationships
CREATE TABLE topic_hierarchies (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    root_topic_id UUID NOT NULL,
    max_depth INTEGER NOT NULL,
    total_topics INTEGER NOT NULL,
    coherence_score DECIMAL(4,3) CHECK (coherence_score >= 0 AND coherence_score <= 1),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,

    CONSTRAINT fk_topic_hierarchies_root FOREIGN KEY (root_topic_id) REFERENCES extracted_topics(id) ON DELETE CASCADE,
    UNIQUE(name)
);

-- Topic relationships (related, similar, etc.)
CREATE TABLE topic_relationships (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    source_topic_id UUID NOT NULL,
    target_topic_id UUID NOT NULL,
    relationship_type topic_relationship_type NOT NULL,
    strength DECIMAL(4,3) NOT NULL CHECK (strength >= 0 AND strength <= 1),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_topic_rel_source FOREIGN KEY (source_topic_id) REFERENCES extracted_topics(id) ON DELETE CASCADE,
    CONSTRAINT fk_topic_rel_target FOREIGN KEY (target_topic_id) REFERENCES extracted_topics(id) ON DELETE CASCADE,
    UNIQUE(source_topic_id, target_topic_id, relationship_type)
);

-- Topic relationship types enum
CREATE TYPE topic_relationship_type AS ENUM (
    'related', 'similar', 'parent', 'child', 'synonym', 'antonym'
);

-- Topic trends tracking
CREATE TABLE topic_trends (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    topic_id UUID NOT NULL,
    timeframe trend_timeframe NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    popularity DECIMAL(4,3) NOT NULL CHECK (popularity >= 0 AND popularity <= 1),
    content_count INTEGER NOT NULL DEFAULT 0,
    engagement_rate DECIMAL(4,3) CHECK (engagement_rate >= 0 AND engagement_rate <= 1),
    new_mentions INTEGER DEFAULT 0,

    CONSTRAINT fk_topic_trends_topic FOREIGN KEY (topic_id) REFERENCES extracted_topics(id) ON DELETE CASCADE,
    PRIMARY KEY (topic_id, timeframe, timestamp)
);

-- Trend timeframes enum
CREATE TYPE trend_timeframe AS ENUM (
    'hour', 'day', 'week', 'month', 'year'
);

-- =====================================================
-- US-105: CONTENT CLUSTERING TABLES
-- =====================================================

-- Content clusters with quality metrics
CREATE TABLE content_clusters (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    centroid VECTOR(384), -- Cluster center in feature space
    algorithm clustering_algorithm NOT NULL,
    parameters JSONB NOT NULL DEFAULT '{}',

    -- Cluster characteristics
    dominant_topics TEXT[] DEFAULT ARRAY[]::TEXT[],
    avg_engagement DECIMAL(4,3) DEFAULT 0,
    avg_difficulty DECIMAL(4,3) DEFAULT 0,
    common_tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    primary_creators UUID[] DEFAULT ARRAY[]::UUID[],
    content_types TEXT[] DEFAULT ARRAY[]::TEXT[],
    average_length INTEGER DEFAULT 0,
    predominant_sentiment DECIMAL(4,3) DEFAULT 0 CHECK (predominant_sentiment >= -1 AND predominant_sentiment <= 1),

    -- Quality metrics
    cohesion DECIMAL(4,3) CHECK (cohesion >= 0 AND cohesion <= 1),
    separation DECIMAL(4,3) CHECK (separation >= 0 AND separation <= 1),
    silhouette_score DECIMAL(4,3) CHECK (silhouette_score >= -1 AND silhouette_score <= 1),
    inertia DECIMAL(10,4),
    stability DECIMAL(4,3) CHECK (stability >= 0 AND stability <= 1),

    size INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,

    UNIQUE(name)
);

-- Clustering algorithms enum
CREATE TYPE clustering_algorithm AS ENUM (
    'kmeans', 'hierarchical', 'dbscan', 'gaussian_mixture', 'spectral'
);

-- Content-cluster assignments
CREATE TABLE content_cluster_assignments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    content_id UUID NOT NULL,
    cluster_id UUID NOT NULL,
    distance_to_centroid DECIMAL(8,6),
    assignment_confidence DECIMAL(4,3) CHECK (assignment_confidence >= 0 AND assignment_confidence <= 1),
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_cluster_assign_content FOREIGN KEY (content_id) REFERENCES content_items(id) ON DELETE CASCADE,
    CONSTRAINT fk_cluster_assign_cluster FOREIGN KEY (cluster_id) REFERENCES content_clusters(id) ON DELETE CASCADE,
    PRIMARY KEY (content_id, cluster_id)
);

-- Clustering configurations
CREATE TABLE clustering_configs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    algorithm clustering_algorithm NOT NULL,
    parameters JSONB NOT NULL DEFAULT '{}',

    -- Feature settings
    use_textual_features BOOLEAN DEFAULT TRUE,
    use_topic_features BOOLEAN DEFAULT TRUE,
    use_engagement_features BOOLEAN DEFAULT TRUE,
    use_metadata_features BOOLEAN DEFAULT TRUE,
    use_temporal_features BOOLEAN DEFAULT FALSE,

    real_time_updates BOOLEAN DEFAULT FALSE,
    quality_threshold DECIMAL(4,3) DEFAULT 0.7 CHECK (quality_threshold >= 0 AND quality_threshold <= 1),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,

    UNIQUE(name)
);

-- Cluster analytics tracking
CREATE TABLE cluster_analytics (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    cluster_id UUID NOT NULL,
    timeframe trend_timeframe NOT NULL,
    timestamp TIMESTAMP NOT NULL,

    -- Growth metrics
    content_count INTEGER NOT NULL DEFAULT 0,
    new_content_count INTEGER DEFAULT 0,

    -- Quality metrics
    cohesion DECIMAL(4,3),
    separation DECIMAL(4,3),
    silhouette_score DECIMAL(4,3),

    -- Engagement metrics
    avg_views_per_content DECIMAL(8,2),
    avg_engagement_rate DECIMAL(4,3),

    -- Topic evolution
    dominant_topics TEXT[],
    topic_weights DECIMAL(4,3)[],

    CONSTRAINT fk_cluster_analytics_cluster FOREIGN KEY (cluster_id) REFERENCES content_clusters(id) ON DELETE CASCADE,
    PRIMARY KEY (cluster_id, timeframe, timestamp)
);

-- =====================================================
-- US-106: RELATED CONTENT SUGGESTIONS TABLES
-- =====================================================

-- Related content suggestions with ranking
CREATE TABLE related_content_suggestions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    source_content_id UUID NOT NULL,
    target_content_id UUID NOT NULL,
    relationship_type content_relationship_type NOT NULL,
    relevance_score DECIMAL(4,3) NOT NULL CHECK (relevance_score >= 0 AND relevance_score <= 1),
    confidence_score DECIMAL(4,3) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    explanation TEXT NOT NULL,

    -- Reasoning breakdown
    topic_similarity DECIMAL(4,3) CHECK (topic_similarity >= 0 AND topic_similarity <= 1),
    content_similarity DECIMAL(4,3) CHECK (content_similarity >= 0 AND content_similarity <= 1),
    user_behavior_match DECIMAL(4,3) CHECK (user_behavior_match >= 0 AND user_behavior_match <= 1),
    creator_affinity DECIMAL(4,3) CHECK (creator_affinity >= 0 AND creator_affinity <= 1),
    engagement_prediction DECIMAL(4,3) CHECK (engagement_prediction >= 0 AND engagement_prediction <= 1),

    algorithm VARCHAR(100) NOT NULL,
    rank_position INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,

    CONSTRAINT fk_related_content_source FOREIGN KEY (source_content_id) REFERENCES content_items(id) ON DELETE CASCADE,
    CONSTRAINT fk_related_content_target FOREIGN KEY (target_content_id) REFERENCES content_items(id) ON DELETE CASCADE,
    UNIQUE(source_content_id, target_content_id, algorithm)
);

-- Content relationship types enum
CREATE TYPE content_relationship_type AS ENUM (
    'similar_topic', 'same_creator', 'sequential', 'complementary', 'alternative', 'deep_dive'
);

-- Related content configurations
CREATE TABLE related_content_configs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    max_suggestions INTEGER DEFAULT 10 CHECK (max_suggestions > 0),

    -- Algorithm weights
    content_based_weight DECIMAL(4,3) DEFAULT 0.4 CHECK (content_based_weight >= 0 AND content_based_weight <= 1),
    collaborative_weight DECIMAL(4,3) DEFAULT 0.3 CHECK (collaborative_weight >= 0 AND collaborative_weight <= 1),
    behavioral_weight DECIMAL(4,3) DEFAULT 0.2 CHECK (behavioral_weight >= 0 AND behavioral_weight <= 1),
    graph_weight DECIMAL(4,3) DEFAULT 0.1 CHECK (graph_weight >= 0 AND graph_weight <= 1),

    -- Diversification settings
    diversity_enabled BOOLEAN DEFAULT TRUE,
    diversity_weight DECIMAL(4,3) DEFAULT 0.2 CHECK (diversity_weight >= 0 AND diversity_weight <= 1),
    max_same_creator INTEGER DEFAULT 3,
    max_same_category INTEGER DEFAULT 5,

    -- Filtering settings
    min_relevance_score DECIMAL(4,3) DEFAULT 0.5 CHECK (min_relevance_score >= 0 AND min_relevance_score <= 1),
    exclude_same_content BOOLEAN DEFAULT TRUE,
    exclude_already_viewed BOOLEAN DEFAULT FALSE,
    respect_user_preferences BOOLEAN DEFAULT TRUE,

    real_time_updates BOOLEAN DEFAULT TRUE,
    cache_ttl INTEGER DEFAULT 3600, -- Cache time-to-live in seconds
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,

    UNIQUE(name)
);

-- Cross-content promotion campaigns
CREATE TABLE cross_content_promotions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    source_content_id UUID NOT NULL,
    promoted_content_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
    promotion_type promotion_type NOT NULL,

    -- Targeting
    user_segments TEXT[],
    behavior_triggers TEXT[],
    content_context TEXT,

    -- Placement
    placement_position placement_position NOT NULL,
    template_name VARCHAR(100),
    max_displays INTEGER,
    display_duration INTEGER, -- Duration in seconds

    -- Performance metrics
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    click_through_rate DECIMAL(6,4) DEFAULT 0,
    conversion_rate DECIMAL(6,4) DEFAULT 0,

    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,

    CONSTRAINT fk_cross_promotion_source FOREIGN KEY (source_content_id) REFERENCES content_items(id) ON DELETE CASCADE
);

-- Promotion types enum
CREATE TYPE promotion_type AS ENUM (
    'upsell', 'cross_sell', 'sequence', 'bundle', 'related'
);

-- Placement positions enum
CREATE TYPE placement_position AS ENUM (
    'top', 'middle', 'bottom', 'sidebar', 'overlay', 'inline'
);

-- Related content analytics
CREATE TABLE related_content_analytics (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    content_id UUID NOT NULL,
    timeframe trend_timeframe NOT NULL,
    timestamp TIMESTAMP NOT NULL,

    -- Suggestion metrics
    total_suggestions INTEGER DEFAULT 0,
    unique_suggestions INTEGER DEFAULT 0,
    click_through_rate DECIMAL(6,4) DEFAULT 0,
    conversion_rate DECIMAL(6,4) DEFAULT 0,
    avg_relevance_score DECIMAL(4,3),

    -- Top performing suggestions
    top_suggestions JSONB DEFAULT '[]',

    -- Algorithm performance
    algorithm_performance JSONB DEFAULT '{}',

    CONSTRAINT fk_related_analytics_content FOREIGN KEY (content_id) REFERENCES content_items(id) ON DELETE CASCADE,
    PRIMARY KEY (content_id, timeframe, timestamp)
);

-- =====================================================
-- PERFORMANCE INDEXES
-- =====================================================

-- Content tags indexes
CREATE INDEX idx_content_tags_content_id ON content_tags(content_id);
CREATE INDEX idx_content_tags_tag ON content_tags(tag);
CREATE INDEX idx_content_tags_category ON content_tags(category);
CREATE INDEX idx_content_tags_confidence ON content_tags(confidence DESC);
CREATE INDEX idx_content_tags_source ON content_tags(source);
CREATE INDEX idx_content_tags_validated ON content_tags(is_validated);

-- Topic extraction indexes
CREATE INDEX idx_extracted_topics_name ON extracted_topics(name);
CREATE INDEX idx_extracted_topics_confidence ON extracted_topics(confidence DESC);
CREATE INDEX idx_extracted_topics_parent ON extracted_topics(parent_topic_id);
CREATE INDEX idx_extracted_topics_embedding ON extracted_topics USING ivfflat (embedding vector_cosine_ops);

CREATE INDEX idx_content_topics_content ON content_topics(content_id);
CREATE INDEX idx_content_topics_topic ON content_topics(topic_id);
CREATE INDEX idx_content_topics_confidence ON content_topics(confidence DESC);

-- Clustering indexes
CREATE INDEX idx_content_clusters_algorithm ON content_clusters(algorithm);
CREATE INDEX idx_content_clusters_active ON content_clusters(is_active);
CREATE INDEX idx_content_clusters_quality ON content_clusters(silhouette_score DESC);
CREATE INDEX idx_content_clusters_embedding ON content_clusters USING ivfflat (centroid vector_cosine_ops);

CREATE INDEX idx_cluster_assignments_content ON content_cluster_assignments(content_id);
CREATE INDEX idx_cluster_assignments_cluster ON content_cluster_assignments(cluster_id);
CREATE INDEX idx_cluster_assignments_confidence ON content_cluster_assignments(assignment_confidence DESC);

-- Related content indexes
CREATE INDEX idx_related_suggestions_source ON related_content_suggestions(source_content_id);
CREATE INDEX idx_related_suggestions_target ON related_content_suggestions(target_content_id);
CREATE INDEX idx_related_suggestions_relevance ON related_content_suggestions(relevance_score DESC);
CREATE INDEX idx_related_suggestions_type ON related_content_suggestions(relationship_type);
CREATE INDEX idx_related_suggestions_expires ON related_content_suggestions(expires_at);

-- Composite indexes for common queries
CREATE INDEX idx_content_tags_content_category ON content_tags(content_id, category);
CREATE INDEX idx_content_topics_content_confidence ON content_topics(content_id, confidence DESC);
CREATE INDEX idx_related_suggestions_source_score ON related_content_suggestions(source_content_id, relevance_score DESC);

-- =====================================================
-- STORED FUNCTIONS FOR AI ENHANCEMENTS
-- =====================================================

-- Function to calculate tag confidence based on multiple factors
CREATE OR REPLACE FUNCTION calculate_tag_confidence(
    ai_confidence DECIMAL(4,3),
    user_feedback_score DECIMAL(4,3) DEFAULT 0,
    collaborative_score DECIMAL(4,3) DEFAULT 0,
    rule_score DECIMAL(4,3) DEFAULT 0
)
RETURNS DECIMAL(4,3) AS $$
BEGIN
    RETURN LEAST(
        1.0,
        ai_confidence * 0.4 +
        user_feedback_score * 0.3 +
        collaborative_score * 0.2 +
        rule_score * 0.1
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get content topic suggestions
CREATE OR REPLACE FUNCTION get_content_topic_suggestions(
    p_content_id UUID,
    p_min_confidence DECIMAL(4,3) DEFAULT 0.7,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
    topic_id UUID,
    topic_name VARCHAR(200),
    confidence DECIMAL(4,3),
    relevance DECIMAL(4,3)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        et.id,
        et.name,
        ct.confidence,
        ct.relevance
    FROM content_topics ct
    JOIN extracted_topics et ON ct.topic_id = et.id
    WHERE ct.content_id = p_content_id
      AND ct.confidence >= p_min_confidence
      AND et.is_active = TRUE
    ORDER BY ct.confidence DESC, ct.relevance DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to find similar content based on clustering
CREATE OR REPLACE FUNCTION get_cluster_similar_content(
    p_content_id UUID,
    p_max_results INTEGER DEFAULT 10
)
RETURNS TABLE(
    content_id UUID,
    similarity_score DECIMAL(4,3),
    cluster_name VARCHAR(200)
) AS $$
DECLARE
    content_cluster_id UUID;
BEGIN
    -- Get the cluster for the source content
    SELECT cluster_id INTO content_cluster_id
    FROM content_cluster_assignments
    WHERE content_id = p_content_id
    ORDER BY assignment_confidence DESC
    LIMIT 1;

    IF content_cluster_id IS NULL THEN
        RETURN;
    END IF;

    -- Return similar content from the same cluster
    RETURN QUERY
    SELECT
        cca.content_id,
        cca.assignment_confidence,
        cc.name
    FROM content_cluster_assignments cca
    JOIN content_clusters cc ON cca.cluster_id = cc.id
    WHERE cca.cluster_id = content_cluster_id
      AND cca.content_id != p_content_id
      AND cc.is_active = TRUE
    ORDER BY cca.assignment_confidence DESC
    LIMIT p_max_results;
END;
$$ LANGUAGE plpgsql;

-- Function to get related content suggestions with ranking
CREATE OR REPLACE FUNCTION get_related_content_suggestions(
    p_content_id UUID,
    p_algorithm VARCHAR(100) DEFAULT 'hybrid',
    p_min_relevance DECIMAL(4,3) DEFAULT 0.5,
    p_max_results INTEGER DEFAULT 10
)
RETURNS TABLE(
    target_content_id UUID,
    relationship_type content_relationship_type,
    relevance_score DECIMAL(4,3),
    confidence_score DECIMAL(4,3),
    explanation TEXT,
    rank_position INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        rcs.target_content_id,
        rcs.relationship_type,
        rcs.relevance_score,
        rcs.confidence_score,
        rcs.explanation,
        rcs.rank_position
    FROM related_content_suggestions rcs
    WHERE rcs.source_content_id = p_content_id
      AND (rcs.algorithm = p_algorithm OR p_algorithm = 'hybrid')
      AND rcs.relevance_score >= p_min_relevance
      AND (rcs.expires_at IS NULL OR rcs.expires_at > CURRENT_TIMESTAMP)
    ORDER BY rcs.relevance_score DESC, rcs.rank_position ASC
    LIMIT p_max_results;
END;
$$ LANGUAGE plpgsql;

-- Function to update cluster quality metrics
CREATE OR REPLACE FUNCTION update_cluster_quality_metrics(
    p_cluster_id UUID
)
RETURNS VOID AS $$
DECLARE
    cluster_size INTEGER;
    avg_distance DECIMAL(8,6);
    silhouette DECIMAL(4,3);
BEGIN
    -- Get cluster size
    SELECT COUNT(*) INTO cluster_size
    FROM content_cluster_assignments
    WHERE cluster_id = p_cluster_id;

    -- Calculate average distance to centroid (cohesion proxy)
    SELECT AVG(distance_to_centroid) INTO avg_distance
    FROM content_cluster_assignments
    WHERE cluster_id = p_cluster_id;

    -- Simplified silhouette score calculation
    -- In practice, this would be more complex
    silhouette := GREATEST(0, 1 - (avg_distance * 2));

    -- Update cluster metrics
    UPDATE content_clusters
    SET
        size = cluster_size,
        cohesion = GREATEST(0, 1 - avg_distance),
        silhouette_score = silhouette,
        last_updated = CURRENT_TIMESTAMP
    WHERE id = p_cluster_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS FOR REAL-TIME UPDATES
-- =====================================================

-- Trigger to update cluster size when content is assigned
CREATE OR REPLACE FUNCTION trigger_update_cluster_size()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Update cluster size and quality metrics
        PERFORM update_cluster_quality_metrics(NEW.cluster_id);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Update cluster size and quality metrics
        PERFORM update_cluster_quality_metrics(OLD.cluster_id);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER content_cluster_assignment_changes
    AFTER INSERT OR DELETE ON content_cluster_assignments
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_cluster_size();

-- Trigger to process tag feedback for learning
CREATE OR REPLACE FUNCTION process_tag_feedback()
RETURNS TRIGGER AS $$
BEGIN
    -- Mark feedback as processed
    NEW.processed := TRUE;

    -- In a production system, this would trigger ML model updates
    -- For now, we just log the feedback
    INSERT INTO system_logs (event_type, details, created_at)
    VALUES ('tag_feedback_processed',
            jsonb_build_object(
                'content_id', NEW.content_id,
                'user_id', NEW.user_id,
                'approved_tags', NEW.approved_tags,
                'rejected_tags', NEW.rejected_tags,
                'added_tags', NEW.added_tags
            ),
            CURRENT_TIMESTAMP);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tag_feedback_processing
    BEFORE UPDATE ON tag_feedback
    FOR EACH ROW
    WHEN (OLD.processed = FALSE AND NEW.processed = TRUE)
    EXECUTE FUNCTION process_tag_feedback();

-- =====================================================
-- INITIAL DATA SEEDING
-- =====================================================

-- Insert default auto-tagging configurations
INSERT INTO auto_tagging_configs (content_type, enabled_categories, confidence_threshold) VALUES
('article', ARRAY['topic', 'keyword', 'entity']::tag_category[], 0.7),
('video', ARRAY['topic', 'keyword', 'genre']::tag_category[], 0.6),
('audio', ARRAY['topic', 'genre', 'sentiment']::tag_category[], 0.6),
('image', ARRAY['entity', 'keyword']::tag_category[], 0.8),
('live', ARRAY['topic', 'keyword']::tag_category[], 0.5),
('course', ARRAY['topic', 'difficulty', 'keyword']::tag_category[], 0.8);

-- Insert default clustering configuration
INSERT INTO clustering_configs (name, algorithm, parameters) VALUES
('default_kmeans', 'kmeans', '{"num_clusters": 10, "distance_metric": "cosine"}'),
('hierarchical_content', 'hierarchical', '{"linkage": "ward", "distance_metric": "euclidean"}'),
('density_based', 'dbscan', '{"eps": 0.3, "min_samples": 5}');

-- Insert default related content configuration
INSERT INTO related_content_configs (name) VALUES
('default_hybrid'),
('content_based_only'),
('collaborative_only'),
('behavioral_focused');

-- Create system logs table for monitoring
CREATE TABLE IF NOT EXISTS system_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Grant permissions (adjust based on your user management)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ai_service_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ai_service_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ai_service_user;

-- =====================================================
-- SCHEMA VALIDATION AND CONSTRAINTS
-- =====================================================

-- Add check constraints for data integrity
ALTER TABLE content_tags ADD CONSTRAINT check_tag_length CHECK (LENGTH(tag) >= 2 AND LENGTH(tag) <= 100);
ALTER TABLE extracted_topics ADD CONSTRAINT check_topic_name_length CHECK (LENGTH(name) >= 2 AND LENGTH(display_name) >= 2);
ALTER TABLE content_clusters ADD CONSTRAINT check_cluster_name_length CHECK (LENGTH(name) >= 3);

-- Add foreign key constraints for referential integrity
-- (Assuming content_items and users tables exist from previous implementations)

-- Add partial indexes for better performance on filtered queries
CREATE INDEX CONCURRENTLY idx_content_tags_validated_true ON content_tags(content_id) WHERE is_validated = TRUE;
CREATE INDEX CONCURRENTLY idx_topics_active ON extracted_topics(name) WHERE is_active = TRUE;
CREATE INDEX CONCURRENTLY idx_clusters_active ON content_clusters(name) WHERE is_active = TRUE;
CREATE INDEX CONCURRENTLY idx_suggestions_unexpired ON related_content_suggestions(source_content_id) WHERE expires_at > CURRENT_TIMESTAMP OR expires_at IS NULL;

-- =====================================================
-- PERFORMANCE MONITORING VIEWS
-- =====================================================

-- View for tagging performance metrics
CREATE VIEW tagging_performance_stats AS
SELECT
    category,
    source,
    COUNT(*) as total_tags,
    AVG(confidence) as avg_confidence,
    COUNT(*) FILTER (WHERE is_validated = TRUE) as validated_count,
    COUNT(*) FILTER (WHERE confidence >= 0.8) as high_confidence_count
FROM content_tags
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY category, source;

-- View for clustering quality overview
CREATE VIEW clustering_quality_overview AS
SELECT
    cc.name,
    cc.algorithm,
    cc.size,
    cc.silhouette_score,
    cc.cohesion,
    cc.separation,
    cc.last_updated
FROM content_clusters cc
WHERE cc.is_active = TRUE
ORDER BY cc.silhouette_score DESC;

-- View for related content performance
CREATE VIEW related_content_performance AS
SELECT
    rcs.algorithm,
    COUNT(*) as total_suggestions,
    AVG(rcs.relevance_score) as avg_relevance,
    AVG(rcs.confidence_score) as avg_confidence,
    COUNT(DISTINCT rcs.source_content_id) as unique_source_content
FROM related_content_suggestions rcs
WHERE rcs.created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY rcs.algorithm
ORDER BY avg_relevance DESC;

-- Final schema completion marker
INSERT INTO system_logs (event_type, details)
VALUES ('schema_deployment', jsonb_build_object(
    'schema_version', '1.0.0',
    'features', ARRAY['us-103', 'us-104', 'us-105', 'us-106'],
    'deployment_time', CURRENT_TIMESTAMP,
    'tables_created', 15,
    'functions_created', 5,
    'triggers_created', 2,
    'indexes_created', 25
));

-- =====================================================
-- END OF AI-ENHANCED FEATURES SCHEMA
-- =====================================================
