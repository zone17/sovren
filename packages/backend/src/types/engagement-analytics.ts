/**
 * 📊 **ENGAGEMENT ANALYTICS BACKEND TYPES - ELITE ENGINEERING**
 *
 * Backend implementation types for US-107 through US-110:
 * - Database models and interfaces
 * - Service layer contracts
 * - AI model integration types
 * - Performance optimization types
 */

import { z } from 'zod';

// =====================================================
// DATABASE MODEL INTERFACES
// =====================================================

export interface EngagementMetricsModel {
  id: string;
  content_id: string;
  creator_id: string;
  timeframe: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
  timestamp: Date;

  // Raw metrics
  views: number;
  likes: number;
  shares: number;
  comments: number;
  saves: number;
  click_through: number;
  time_spent: number;
  scroll_depth: number;
  return_visits: number;
  conversions: number;

  // Calculated metrics
  engagement_score: number;
  quality_score: number;
  viral_coefficient: number;
  stickiness_factor: number;

  // AI insights
  patterns_detected: string[];
  anomalies_detected: string[];

  created_at: Date;
  updated_at: Date;
}

export interface PerformancePredictionModel {
  id: string;
  content_id?: string;
  creator_id: string;

  // Content features for prediction
  content_features: Record<string, any>;

  // Predictions
  predicted_views_24h: number;
  predicted_views_7d: number;
  predicted_engagement_rate: number;
  predicted_viral_score: number;
  predicted_revenue: number;

  // Confidence scores
  confidence_views_24h: number;
  confidence_views_7d: number;
  confidence_engagement: number;
  confidence_viral: number;
  confidence_revenue: number;

  // Model metadata
  model_version: string;
  algorithm: string;
  accuracy_score: number;

  created_at: Date;
  expires_at: Date;
}

export interface GrowthForecastModel {
  id: string;
  creator_id: string;

  // Current metrics
  current_followers: number;
  current_engagement_rate: number;
  current_growth_rate: number;
  current_content_frequency: number;

  // Forecasts by timeframe
  forecast_1m_optimistic: number;
  forecast_1m_realistic: number;
  forecast_1m_pessimistic: number;
  forecast_3m_optimistic: number;
  forecast_3m_realistic: number;
  forecast_3m_pessimistic: number;
  forecast_6m_optimistic: number;
  forecast_6m_realistic: number;
  forecast_6m_pessimistic: number;
  forecast_1y_optimistic: number;
  forecast_1y_realistic: number;
  forecast_1y_pessimistic: number;

  // Growth drivers
  growth_drivers: Record<string, number>;

  // Model accuracy
  confidence_level: number;
  algorithm: string;
  last_updated: Date;

  created_at: Date;
}

export interface OptimizationSuggestionModel {
  id: string;
  content_id: string;
  creator_id: string;

  category: string;
  title: string;
  description: string;
  current_value?: string;
  suggested_value: string;

  // Impact prediction
  predicted_engagement_lift: number;
  prediction_confidence: number;
  timeframe: string;

  priority: 'critical' | 'high' | 'medium' | 'low';
  effort_required: 'low' | 'medium' | 'high';

  implementation_guide: string[];
  supporting_data: Record<string, any>;

  // Tracking
  status: 'pending' | 'in_progress' | 'implemented' | 'rejected';
  implemented_at?: Date;

  created_at: Date;
  updated_at: Date;
}

// =====================================================
// SERVICE INTERFACE CONTRACTS
// =====================================================

export interface IEngagementAnalyticsService {
  // US-107: AI-driven engagement metrics
  generateEngagementMetrics(contentId: string, timeframe: string): Promise<EngagementMetricsModel>;
  detectEngagementPatterns(
    creatorId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<any[]>;
  generateAIInsights(engagementData: any): Promise<any[]>;
  benchmarkEngagement(contentId: string, category: string): Promise<any>;

  // US-108: Content performance predictions
  predictContentPerformance(contentFeatures: any): Promise<PerformancePredictionModel>;
  analyzeContentFeatures(content: any): Promise<any>;
  validatePredictions(predictionId: string, actualResults: any): Promise<any>;
  explainPrediction(predictionId: string): Promise<any>;

  // US-109: Audience growth forecasting
  forecastAudienceGrowth(creatorId: string, scenarios: any[]): Promise<GrowthForecastModel>;
  analyzeGrowthTrends(creatorId: string): Promise<any>;
  trackGrowthGoals(creatorId: string): Promise<any[]>;
  generateGrowthStrategies(currentMetrics: any): Promise<any[]>;

  // US-110: Content optimization suggestions
  generateOptimizationSuggestions(contentId: string): Promise<OptimizationSuggestionModel[]>;
  analyzeContentOptimization(content: any): Promise<any>;
  suggestABTests(contentId: string): Promise<any[]>;
  trackOptimizationResults(suggestionId: string): Promise<any>;

  // Health and monitoring
  getHealthStatus(): Promise<any>;
  getSystemMetrics(): Promise<any>;
}

// =====================================================
// AI MODEL INTEGRATION TYPES
// =====================================================

export interface AIModelConfig {
  model_name: string;
  version: string;
  accuracy_threshold: number;
  confidence_threshold: number;
  update_frequency: string;
  training_data_size: number;
  last_trained: Date;
}

export interface EngagementAIModel extends AIModelConfig {
  pattern_recognition_accuracy: number;
  anomaly_detection_sensitivity: number;
  insight_generation_rate: number;
}

export interface PredictionAIModel extends AIModelConfig {
  feature_importance: Record<string, number>;
  prediction_horizon: string;
  validation_accuracy: number;
  error_margins: Record<string, number>;
}

export interface ForecastingAIModel extends AIModelConfig {
  scenario_modeling_accuracy: number;
  trend_analysis_confidence: number;
  growth_factor_weights: Record<string, number>;
}

export interface OptimizationAIModel extends AIModelConfig {
  suggestion_relevance_score: number;
  impact_prediction_accuracy: number;
  category_coverage: string[];
}

// =====================================================
// PERFORMANCE OPTIMIZATION TYPES
// =====================================================

export interface CacheConfig {
  ttl_seconds: number;
  max_size: number;
  eviction_policy: 'lru' | 'fifo' | 'lfu';
  cache_key_pattern: string;
}

export interface EngagementAnalyticsCache {
  metrics_cache: CacheConfig;
  predictions_cache: CacheConfig;
  forecasts_cache: CacheConfig;
  suggestions_cache: CacheConfig;
}

export interface PerformanceMetrics {
  avg_response_time_ms: number;
  cache_hit_rate: number;
  prediction_accuracy: number;
  throughput_requests_per_second: number;
  error_rate: number;
  model_inference_time_ms: number;
}

// =====================================================
// ERROR HANDLING TYPES
// =====================================================

export class EngagementAnalyticsError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'EngagementAnalyticsError';
  }
}

export class PredictionError extends EngagementAnalyticsError {
  constructor(message: string, details?: any) {
    super(message, 'PREDICTION_ERROR', 422, details);
    this.name = 'PredictionError';
  }
}

export class ForecastingError extends EngagementAnalyticsError {
  constructor(message: string, details?: any) {
    super(message, 'FORECASTING_ERROR', 422, details);
    this.name = 'ForecastingError';
  }
}

export class OptimizationError extends EngagementAnalyticsError {
  constructor(message: string, details?: any) {
    super(message, 'OPTIMIZATION_ERROR', 422, details);
    this.name = 'OptimizationError';
  }
}

// =====================================================
// API VALIDATION SCHEMAS
// =====================================================

export const CreateEngagementMetricsSchema = z.object({
  content_id: z.string().uuid(),
  timeframe: z.enum(['hour', 'day', 'week', 'month', 'quarter', 'year']),
  include_patterns: z.boolean().default(true),
  include_insights: z.boolean().default(true),
});

export const PredictPerformanceSchema = z.object({
  content_features: z.record(z.any()),
  prediction_horizon: z.enum(['24h', '7d', '30d']),
  include_confidence: z.boolean().default(true),
  include_explanation: z.boolean().default(false),
});

export const ForecastGrowthSchema = z.object({
  timeframe: z.enum(['1m', '3m', '6m', '1y', '2y']),
  scenarios: z.array(
    z.object({
      name: z.string(),
      parameters: z.record(z.number()),
    })
  ),
  include_goals: z.boolean().default(true),
});

export const GenerateOptimizationsSchema = z.object({
  content_id: z.string().uuid(),
  categories: z.array(z.string()).optional(),
  priority_filter: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  include_ab_tests: z.boolean().default(true),
});

// =====================================================
// RATE LIMITING CONFIGURATION
// =====================================================

export const RATE_LIMITS = {
  ENGAGEMENT_METRICS: {
    requests: 200,
    window: '15m',
    skipSuccessfulRequests: false,
  },
  PERFORMANCE_PREDICTIONS: {
    requests: 100,
    window: '15m',
    skipSuccessfulRequests: false,
  },
  GROWTH_FORECASTING: {
    requests: 50,
    window: '1h',
    skipSuccessfulRequests: false,
  },
  OPTIMIZATION_SUGGESTIONS: {
    requests: 150,
    window: '15m',
    skipSuccessfulRequests: false,
  },
} as const;

// =====================================================
// TYPE EXPORTS
// =====================================================

export type CreateEngagementMetricsRequest = z.infer<typeof CreateEngagementMetricsSchema>;
export type PredictPerformanceRequest = z.infer<typeof PredictPerformanceSchema>;
export type ForecastGrowthRequest = z.infer<typeof ForecastGrowthSchema>;
export type GenerateOptimizationsRequest = z.infer<typeof GenerateOptimizationsSchema>;
