/**
 * Wellness Domain Types
 * Shared types for EPIC-007: Creator Wellness System
 *
 * Used by both backend services and frontend API clients.
 */

// ============================================================================
// Work Pattern Types
// ============================================================================

export type WorkActivityType = 'content_creation' | 'engagement' | 'management';

export interface WorkPattern {
  id: string;
  creator_id: string;
  type: WorkActivityType;
  duration_mins: number;
  timestamp: string;
  metadata?: Record<string, string>;
  created_at: string;
}

export interface WorkPatternAggregation {
  period: '7d' | '30d' | '90d';
  total_hours: number;
  daily_average_hours: number;
  breakdown: {
    content_creation: { hours: number; percentage: number };
    engagement: { hours: number; percentage: number };
    management: { hours: number; percentage: number };
  };
  daily: DailyWorkPattern[];
  rest_days: number;
  baseline_established: boolean;
}

export interface DailyWorkPattern {
  date: string;
  total_hours: number;
  content_creation_mins: number;
  engagement_mins: number;
  management_mins: number;
}

export interface HeatmapEntry {
  day: number; // 0 (Monday) - 6 (Sunday)
  hour: number; // 0-23
  intensity: number; // 0.0 - 1.0
  total_mins: number;
}

export interface HeatmapData {
  period: '7d' | '30d';
  heatmap: HeatmapEntry[];
  peak_hours: number[];
  quiet_hours: number[];
}

// ============================================================================
// Burnout Risk Types
// ============================================================================

export type BurnoutLevel = 'low' | 'moderate' | 'high' | 'critical';
export type SensitivityLevel = 'relaxed' | 'normal' | 'sensitive';

export interface BurnoutFactor {
  value: number;
  weight: number;
  detail: string;
}

export interface BurnoutFactors {
  work_hours_trend: BurnoutFactor;
  posting_frequency: BurnoutFactor;
  engagement_drop: BurnoutFactor;
  hour_regularity: BurnoutFactor;
  rest_day_deficit: BurnoutFactor;
}

export interface BurnoutRiskScore {
  score: number | null;
  level: BurnoutLevel;
  factors: BurnoutFactors;
  baseline_ready: boolean;
  baseline_days_remaining: number;
  history: BurnoutHistoryEntry[];
  recommendations: string[];
  updated_at: string;
}

export interface BurnoutHistoryEntry {
  week: string; // ISO week: '2026-W07'
  score: number;
  level: BurnoutLevel;
}

// ============================================================================
// Schedule Types
// ============================================================================

export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export interface ProductiveWindow {
  day: DayOfWeek;
  start: string; // HH:MM
  end: string; // HH:MM
  energy_score: number;
}

export interface ScheduleRecommendation {
  recommended_posts_per_week: number;
  current_posts_per_week: number;
  optimal_days: DayOfWeek[];
  optimal_hours: number[];
  productive_windows: ProductiveWindow[];
  content_buffer_days: number;
  buffer_threshold: number;
  buffer_status: 'above_threshold' | 'at_threshold' | 'below_threshold';
}

export type BufferStatus = 'above_threshold' | 'at_threshold' | 'below_threshold';

export interface BufferDepth {
  buffer_days: number;
  scheduled_posts: number;
  threshold: number;
  status: BufferStatus;
  next_scheduled: string | null;
  last_scheduled: string | null;
}

// ============================================================================
// Boundary Types
// ============================================================================

export type AvailabilityStatus = 'hidden' | 'available' | 'creating' | 'offline';

export interface FocusHours {
  enabled: boolean;
  start: string; // HH:MM
  end: string; // HH:MM
  timezone: string;
  days: DayOfWeek[];
}

export interface DndMode {
  active: boolean;
  auto_response_enabled: boolean;
  auto_response_template: string;
}

export interface CreatorBoundaries {
  focus_hours: FocusHours;
  weekly_engagement_budget_mins: number;
  engagement_used_mins: number | null; // null = not yet implemented
  dnd_mode: DndMode;
  availability_status: AvailabilityStatus;
  availability_public: boolean;
  notification_batching: boolean;
}

// ============================================================================
// Pulse Check-In Types
// ============================================================================

export interface PulseCheckIn {
  id: string;
  energy: number; // 1-5
  motivation: number; // 1-5
  stress: number; // 1-5
  composite_score: number;
  created_at: string;
}

export type PulseTrendDirection = 'improving' | 'declining' | 'stable';

export interface PulseTrend {
  direction: PulseTrendDirection;
  average_composite: number;
  change_from_previous_period: number;
}

export interface PulseHistory {
  entries: PulseCheckIn[];
  trend: PulseTrend;
}

// ============================================================================
// Benchmark Types
// ============================================================================

export interface PercentileBreakdown {
  p25: number;
  p50: number;
  p75: number;
}

export interface WellnessBenchmark {
  average_weekly_hours: number;
  average_composite_score: number;
  percentile_breakdowns: {
    work_hours: PercentileBreakdown;
    composite_score: PercentileBreakdown;
  };
  sample_size: number;
  updated_at: string;
}
