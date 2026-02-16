// Wellness Feature Module Exports

// Error Boundary
export { WellnessErrorBoundary } from './ErrorBoundary';

// Hooks
export { useGetBenchmarks } from './hooks/useBenchmarks';
export { useBoundaries, useUpdateBoundaries } from './hooks/useBoundaries';
export { useBurnoutScore, useUpdateSensitivity } from './hooks/useBurnoutScore';
export { useGetResourceLibrary } from './hooks/useResourceLibrary';
export { useScheduleRecommendations } from './hooks/useScheduleRecommendations';
export { useWellnessHeatmap, useWellnessPatterns } from './hooks/useWellnessPatterns';
export { useSubmitPulse, useWellnessPulseHistory } from './hooks/useWellnessPulse';

// API Service
export { wellnessApi } from './services/wellnessApi';

// Types
export type {
  ActivityType,
  BoundaryConfig,
  BoundaryUpdatePayload,
  BurnoutFactor,
  BurnoutLevel,
  BurnoutScore,
  DailyPattern,
  DayOfWeek,
  FocusHoursConfig,
  HeatmapCell,
  HeatmapData,
  PatternPeriod,
  PulseCheckIn,
  PulseHistory,
  PulseSubmission,
  ResourceCategory,
  ScheduleRecommendations,
  WellnessBenchmark,
  WellnessResource,
  WorkPatterns,
} from './types';
