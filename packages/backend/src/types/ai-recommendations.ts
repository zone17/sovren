/**
 * 🤖 **AI RECOMMENDATIONS TYPE DEFINITIONS**
 *
 * Elite TypeScript types for AI-powered content recommendation system
 * Covers US-095 through US-098 implementation
 *
 * @author Sovren Platform Team
 * @version 1.0.0
 */

// ===== US-095: Personalized Content Recommendations =====

export interface UserPreferences {
  id: string;
  user_id: string;

  // Content Preferences
  preferred_content_types: string[];
  preferred_tags: string[];
  preferred_creators: string[];
  preferred_difficulty_levels: ('beginner' | 'intermediate' | 'advanced' | 'expert')[];

  // Behavioral Preferences (learned)
  reading_time_preference: number; // in minutes
  engagement_type_weights: {
    like: number;
    comment: number;
    share: number;
    bookmark: number;
  };
  content_length_preference: 'short' | 'medium' | 'long';

  // AI Learning Data
  confidence_score: number; // 0-1
  learning_iterations: number;

  // Temporal Preferences
  preferred_publish_timeframe: 'recent' | 'popular' | 'evergreen';
  seasonal_preferences: Record<string, any>;

  // Privacy Settings
  allow_behavioral_tracking: boolean;
  allow_collaborative_filtering: boolean;

  // Timestamps
  created_at: string;
  updated_at: string;
  last_recommendation_at?: string;
}

export interface PersonalizationConfig {
  weight_user_preferences: number;
  weight_behavioral_data: number;
  weight_collaborative_filtering: number;
  weight_content_similarity: number;
  min_confidence_threshold: number;
  max_recommendations_per_request: number;
  recommendation_expiry_hours: number;
}

// ===== US-096: Behavioral Recommendations =====

export type BehaviorEventType =
  | 'content_view'
  | 'content_like'
  | 'content_unlike'
  | 'content_comment'
  | 'content_share'
  | 'content_bookmark'
  | 'content_purchase'
  | 'creator_follow'
  | 'creator_unfollow'
  | 'search_query'
  | 'category_browse'
  | 'recommendation_click'
  | 'recommendation_dismiss'
  | 'feedback_positive'
  | 'feedback_negative';

export interface UserBehaviorEvent {
  id: string;
  user_id?: string;
  session_id?: string;

  // Event Details
  event_type: BehaviorEventType;

  // Content Context
  content_id?: string;
  content_type?: string;
  content_tags?: string[];
  creator_id?: string;

  // Behavioral Metrics
  dwell_time: number; // in seconds
  scroll_depth: number; // 0-1
  interaction_quality: number; // 0-1

  // Context Data
  source_location?: string;
  device_type?: string;
  referrer_url?: string;
  search_query?: string;

  // AI Processing
  processed_for_ml: boolean;

  // Timestamps
  timestamp: string;
}

export interface BehaviorPattern {
  user_id: string;
  pattern_type: 'content_preference' | 'temporal_usage' | 'engagement_style' | 'discovery_behavior';
  pattern_data: Record<string, any>;
  confidence: number;
  detected_at: string;
  expires_at?: string;
}

export interface BehaviorAnalytics {
  user_id: string;
  time_period: {
    start: string;
    end: string;
  };
  total_events: number;
  event_distribution: Record<BehaviorEventType, number>;
  engagement_score: number;
  activity_level: 'low' | 'medium' | 'high';
  primary_interests: string[];
  behavioral_segments: string[];
}

// ===== US-097: Content Similarity Analysis =====

export interface ContentSimilarity {
  id: string;
  content_a_id: string;
  content_b_id: string;

  // Similarity Metrics
  overall_similarity: number; // 0-1
  semantic_similarity: number; // 0-1
  tag_similarity: number; // 0-1
  creator_similarity: number; // 0-1
  engagement_similarity: number; // 0-1

  // Content Features
  content_features: Record<string, any>;
  similarity_reasons: string[];

  // Quality and Confidence
  confidence_score: number; // 0-1
  calculation_method: 'semantic' | 'collaborative' | 'content_based' | 'hybrid';

  // Timestamps
  calculated_at: string;
  last_validated_at?: string;
}

export interface SimilarityCalculationRequest {
  content_id: string;
  comparison_content_ids?: string[];
  similarity_threshold?: number;
  max_results?: number;
  include_reasons?: boolean;
  calculation_method?: 'semantic' | 'collaborative' | 'content_based' | 'hybrid';
}

export interface SimilarContentResponse {
  content_id: string;
  similar_content: Array<{
    content_id: string;
    similarity_score: number;
    similarity_reasons: string[];
    confidence: number;
  }>;
  calculation_metadata: {
    method_used: string;
    processing_time_ms: number;
    total_comparisons: number;
  };
}

// ===== US-098: Recommendation Feedback =====

export type FeedbackType =
  | 'like'
  | 'dislike'
  | 'not_interested'
  | 'irrelevant'
  | 'inappropriate'
  | 'spam';

export interface RecommendationFeedback {
  id: string;
  user_id: string;
  content_id: string;
  recommendation_id?: string;

  // Feedback Details
  feedback_type: FeedbackType;
  rating?: number; // 1-5

  // Feedback Context
  recommendation_source?: string;
  recommendation_algorithm?: string;
  position_in_list?: number;

  // User Experience
  explanation_helpful?: boolean;
  would_recommend_to_others?: boolean;
  comments?: string;

  // Processing
  processed_for_learning: boolean;
  impact_on_model: number;

  // Timestamps
  created_at: string;
}

export interface FeedbackAnalytics {
  feedback_summary: {
    total_feedback: number;
    positive_feedback: number;
    negative_feedback: number;
    feedback_rate: number;
  };
  feedback_by_type: Record<FeedbackType, number>;
  feedback_by_algorithm: Record<
    string,
    {
      total: number;
      positive: number;
      negative: number;
      average_rating: number;
    }
  >;
  temporal_trends: Array<{
    date: string;
    feedback_count: number;
    satisfaction_score: number;
  }>;
}

// ===== Core Recommendation Types =====

export type RecommendationAlgorithm =
  | 'collaborative'
  | 'content_based'
  | 'hybrid'
  | 'behavioral'
  | 'trending';

export interface ContentRecommendation {
  id: string;
  user_id: string;
  content_id: string;

  // Recommendation Scoring
  recommendation_score: number; // 0-1
  confidence_score: number; // 0-1
  rank_position: number;

  // Algorithm Details
  algorithm_type: RecommendationAlgorithm;
  algorithm_version: string;
  explanation: string;
  reasoning_factors: Record<string, any>;

  // Context
  recommendation_context: string;
  session_id?: string;

  // Performance Tracking
  viewed: boolean;
  clicked: boolean;
  converted: boolean;
  dismissed: boolean;

  // Temporal Relevance
  expires_at?: string;
  valid_from: string;

  // Timestamps
  generated_at: string;
  viewed_at?: string;
  clicked_at?: string;
}

export interface RecommendationRequest {
  user_id: string;
  context: 'homepage' | 'post_read' | 'search_results' | 'category_browse' | 'profile_visit';
  content_id?: string; // For similar content recommendations
  limit?: number;
  algorithm_preference?: RecommendationAlgorithm[];
  include_explanation?: boolean;
  filters?: {
    content_types?: string[];
    tags?: string[];
    exclude_creators?: string[];
    min_publication_date?: string;
    is_premium?: boolean;
  };
}

export interface RecommendationResponse {
  recommendations: Array<{
    content_id: string;
    title: string;
    excerpt?: string;
    content_type: string;
    tags: string[];
    author: {
      id: string;
      username: string;
      display_name: string;
      avatar_url?: string;
    };
    recommendation_score: number;
    confidence_score: number;
    explanation: string;
    reasoning_factors: string[];
    estimated_read_time?: number;
    published_at: string;
  }>;
  metadata: {
    total_recommendations: number;
    algorithm_used: RecommendationAlgorithm;
    processing_time_ms: number;
    personalization_score: number;
    cache_hit: boolean;
  };
}

// ===== Analytics and Performance Types =====

export interface RecommendationAnalytics {
  id: string;
  date: string;
  hour?: number;
  user_id?: string;
  user_cohort?: string;

  // Algorithm Performance
  algorithm_type: RecommendationAlgorithm;
  total_recommendations: number;
  total_views: number;
  total_clicks: number;
  total_conversions: number;
  total_dismissals: number;

  // Metrics
  click_through_rate: number;
  conversion_rate: number;
  engagement_rate: number;
  relevance_score: number;

  // Feedback Metrics
  positive_feedback: number;
  negative_feedback: number;
  feedback_rate: number;

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface PerformanceMetrics {
  recommendation_accuracy: number;
  user_satisfaction_score: number;
  algorithm_performance: Record<
    RecommendationAlgorithm,
    {
      accuracy: number;
      precision: number;
      recall: number;
      f1_score: number;
      click_through_rate: number;
      conversion_rate: number;
    }
  >;
  system_performance: {
    average_response_time_ms: number;
    cache_hit_rate: number;
    daily_active_users: number;
    recommendations_served: number;
  };
}

// ===== Service Configuration Types =====

export interface AIRecommendationServiceConfig {
  // API Configuration
  openai_api_key?: string;
  embedding_model: string;
  max_embedding_tokens: number;

  // Algorithm Weights
  algorithm_weights: Record<RecommendationAlgorithm, number>;
  personalization_threshold: number;
  similarity_threshold: number;

  // Performance Settings
  cache_duration_minutes: number;
  max_concurrent_calculations: number;
  batch_processing_size: number;

  // Quality Controls
  min_confidence_score: number;
  max_recommendations_per_user: number;
  recommendation_cooldown_hours: number;

  // Privacy and Compliance
  data_retention_days: number;
  anonymize_behavior_data: boolean;
  gdpr_compliance_mode: boolean;
}

// ===== Error Types =====

export class RecommendationError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'RecommendationError';
  }
}

export class SimilarityCalculationError extends Error {
  constructor(
    message: string,
    public content_id: string,
    public calculation_method: string
  ) {
    super(message);
    this.name = 'SimilarityCalculationError';
  }
}

export class BehaviorTrackingError extends Error {
  constructor(
    message: string,
    public event_type: BehaviorEventType,
    public user_id?: string
  ) {
    super(message);
    this.name = 'BehaviorTrackingError';
  }
}

// ===== Utility Types =====

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface ValidationResult {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ProcessingStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress_percentage: number;
  estimated_completion_time?: string;
  error_message?: string;
}

// ===== Export all types =====
// Note: Additional type exports can be added here when content and user type files are created
