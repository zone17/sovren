// Wellness Feature Types — re-exported from @sovren/shared with frontend aliases
// See packages/shared/src/types/wellness.ts for canonical definitions.

// Re-export shared types directly (names match)
export type {
  BurnoutLevel,
  BurnoutFactor,
  BufferStatus,
  DayOfWeek,
  ProductiveWindow,
  PulseCheckIn,
  PulseTrend,
  PulseHistory,
  HeatmapData,
  AvailabilityStatus,
  WellnessBenchmark,
  PercentileBreakdown,
} from '@sovren/shared/types/wellness';

// Re-export shared types with frontend aliases (names differ between packages)
export type { WorkActivityType as ActivityType } from '@sovren/shared/types/wellness';
export type { SensitivityLevel as Sensitivity } from '@sovren/shared/types/wellness';
export type { PulseTrendDirection as TrendDirection } from '@sovren/shared/types/wellness';
export type { WorkPattern as WorkPatternEntry } from '@sovren/shared/types/wellness';
export type { DailyWorkPattern as DailyPattern } from '@sovren/shared/types/wellness';
export type { WorkPatternAggregation as WorkPatterns } from '@sovren/shared/types/wellness';
export type { HeatmapEntry as HeatmapCell } from '@sovren/shared/types/wellness';
export type { BurnoutHistoryEntry as BurnoutScoreHistory } from '@sovren/shared/types/wellness';
export type { BurnoutRiskScore as BurnoutScore } from '@sovren/shared/types/wellness';
export type { ScheduleRecommendation as ScheduleRecommendations } from '@sovren/shared/types/wellness';
export type { FocusHours as FocusHoursConfig } from '@sovren/shared/types/wellness';
export type { DndMode as DNDMode } from '@sovren/shared/types/wellness';
export type { CreatorBoundaries as BoundaryConfig } from '@sovren/shared/types/wellness';

// --- Frontend-only types (UI state, form payloads, component props) ---

/** Period filter for pulse history queries */
export type PulsePeriod = '30d' | '90d' | 'all';

/** Period filter for work pattern queries */
export type PatternPeriod = '7d' | '30d' | '90d';

/** Period filter for heatmap queries */
export type HeatmapPeriod = '7d' | '30d';

/** Inline breakdown used in WorkPatterns.breakdown */
export interface ActivityBreakdown {
  hours: number;
  percentage: number;
}

/** Payload for updating boundary settings (partial update) */
export interface BoundaryUpdatePayload {
  focus_hours?: Partial<import('@sovren/shared/types/wellness').FocusHours>;
  weekly_engagement_budget_mins?: number;
  dnd_mode?: Partial<import('@sovren/shared/types/wellness').DndMode>;
  availability_status?: import('@sovren/shared/types/wellness').AvailabilityStatus;
  notification_batching?: boolean;
}

/** Payload for submitting a pulse check-in */
export interface PulseSubmission {
  energy: number;
  motivation: number;
  stress: number;
}

// --- Resource types (static, frontend-only) ---

export type ResourceCategory = 'communities' | 'articles' | 'tools' | 'crisis';

export interface WellnessResource {
  id: string;
  title: string;
  description: string;
  category: ResourceCategory;
  url: string;
}

// --- API wrapper (frontend-only) ---

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}
