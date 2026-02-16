// Wellness Feature Types — matching Phase 7 API spec

export type ActivityType = 'content_creation' | 'engagement' | 'management';
export type BurnoutLevel = 'low' | 'moderate' | 'high' | 'critical';
export type Sensitivity = 'relaxed' | 'normal' | 'sensitive';
export type AvailabilityStatus = 'available' | 'creating' | 'offline' | 'hidden';
export type PulsePeriod = '30d' | '90d' | 'all';
export type PatternPeriod = '7d' | '30d' | '90d';
export type HeatmapPeriod = '7d' | '30d';
export type TrendDirection = 'improving' | 'stable' | 'declining';
export type BufferStatus = 'below_threshold' | 'at_threshold' | 'above_threshold';
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

// --- API Response Types ---

export interface WorkPatternEntry {
  id: string;
  creator_id: string;
  type: ActivityType;
  duration_mins: number;
  timestamp: string;
  created_at: string;
}

export interface ActivityBreakdown {
  hours: number;
  percentage: number;
}

export interface DailyPattern {
  date: string;
  total_hours: number;
  content_creation_mins: number;
  engagement_mins: number;
  management_mins: number;
}

export interface WorkPatterns {
  period: PatternPeriod;
  total_hours: number;
  daily_average_hours: number;
  breakdown: {
    content_creation: ActivityBreakdown;
    engagement: ActivityBreakdown;
    management: ActivityBreakdown;
  };
  daily: DailyPattern[];
  rest_days: number;
  baseline_established: boolean;
}

export interface HeatmapCell {
  day: number;
  hour: number;
  intensity: number;
  total_mins: number;
}

export interface HeatmapData {
  period: HeatmapPeriod;
  heatmap: HeatmapCell[];
  peak_hours: number[];
  quiet_hours: number[];
}

export interface BurnoutFactor {
  value: number;
  weight: number;
  detail: string;
}

export interface BurnoutScoreHistory {
  week: string;
  score: number;
  level: BurnoutLevel;
}

export interface BurnoutScore {
  score: number | null;
  level: BurnoutLevel;
  factors: {
    work_hours_trend: BurnoutFactor;
    posting_frequency: BurnoutFactor;
    engagement_drop: BurnoutFactor;
    hour_regularity: BurnoutFactor;
    rest_day_deficit: BurnoutFactor;
  };
  baseline_ready: boolean;
  baseline_days_remaining: number;
  history: BurnoutScoreHistory[];
  recommendations: string[];
  updated_at: string;
}

export interface ProductiveWindow {
  day: DayOfWeek;
  start: string;
  end: string;
  energy_score: number;
}

export interface ScheduleRecommendations {
  recommended_posts_per_week: number;
  current_posts_per_week: number;
  optimal_days: DayOfWeek[];
  optimal_hours: number[];
  productive_windows: ProductiveWindow[];
  content_buffer_days: number;
  buffer_threshold: number;
  buffer_status: BufferStatus;
}

export interface FocusHoursConfig {
  enabled: boolean;
  start: string;
  end: string;
  timezone: string;
  days: DayOfWeek[];
}

export interface DNDMode {
  active: boolean;
  auto_response_enabled: boolean;
  auto_response_template: string;
}

export interface BoundaryConfig {
  focus_hours: FocusHoursConfig;
  weekly_engagement_budget_mins: number;
  engagement_used_mins: number;
  dnd_mode: DNDMode;
  availability_status: AvailabilityStatus;
  availability_public: boolean;
  notification_batching: boolean;
}

export interface BoundaryUpdatePayload {
  focus_hours?: Partial<FocusHoursConfig>;
  weekly_engagement_budget_mins?: number;
  dnd_mode?: Partial<DNDMode>;
  availability_status?: AvailabilityStatus;
  notification_batching?: boolean;
}

export interface PulseCheckIn {
  id: string;
  energy: number;
  motivation: number;
  stress: number;
  composite_score: number;
  created_at: string;
}

export interface PulseTrend {
  direction: TrendDirection;
  average_composite: number;
  change_from_previous_period: number;
}

export interface PulseHistory {
  entries: PulseCheckIn[];
  trend: PulseTrend;
}

export interface PulseSubmission {
  energy: number;
  motivation: number;
  stress: number;
}

// --- Resource Types (static) ---

export type ResourceCategory = 'communities' | 'articles' | 'tools' | 'crisis';

export interface WellnessResource {
  id: string;
  title: string;
  description: string;
  category: ResourceCategory;
  url: string;
}

// --- API Wrapper ---

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}
