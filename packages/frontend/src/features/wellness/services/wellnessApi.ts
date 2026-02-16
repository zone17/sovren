import apiClient from '@/services/api/apiClient';
import type {
  ApiResponse,
  BoundaryConfig,
  BoundaryUpdatePayload,
  BurnoutScore,
  HeatmapData,
  HeatmapPeriod,
  PatternPeriod,
  PulseCheckIn,
  PulseHistory,
  PulsePeriod,
  PulseSubmission,
  ScheduleRecommendations,
  Sensitivity,
  WorkPatterns,
} from '../types';

const BASE = '/api/v2/wellness';

export const wellnessApi = {
  // -- Work Patterns --

  getPatterns(period: PatternPeriod = '7d'): Promise<ApiResponse<WorkPatterns>> {
    return apiClient['request']('GET', `${BASE}/patterns`, undefined, { period });
  },

  getHeatmap(period: HeatmapPeriod = '7d'): Promise<ApiResponse<HeatmapData>> {
    return apiClient['request']('GET', `${BASE}/patterns/heatmap`, undefined, { period });
  },

  // -- Burnout Risk --

  getRiskScore(): Promise<ApiResponse<BurnoutScore>> {
    return apiClient['request']('GET', `${BASE}/risk-score`);
  },

  updateSensitivity(sensitivity: Sensitivity): Promise<ApiResponse<{ sensitivity: Sensitivity; updated_at: string }>> {
    return apiClient['request']('PUT', `${BASE}/risk-score/sensitivity`, { sensitivity });
  },

  // -- Schedule --

  getScheduleRecommendations(): Promise<ApiResponse<ScheduleRecommendations>> {
    return apiClient['request']('GET', `${BASE}/schedule/recommendations`);
  },

  // -- Boundaries --

  getBoundaries(): Promise<ApiResponse<BoundaryConfig>> {
    return apiClient['request']('GET', `${BASE}/boundaries`);
  },

  updateBoundaries(data: BoundaryUpdatePayload): Promise<ApiResponse<BoundaryConfig>> {
    return apiClient['request']('PUT', `${BASE}/boundaries`, data);
  },

  // -- Pulse Check-Ins --

  submitPulse(data: PulseSubmission): Promise<ApiResponse<PulseCheckIn>> {
    return apiClient['request']('POST', `${BASE}/pulse`, data);
  },

  getPulseHistory(period: PulsePeriod = '90d'): Promise<ApiResponse<PulseHistory>> {
    return apiClient['request']('GET', `${BASE}/pulse/history`, undefined, { period });
  },

  deletePulseHistory(): Promise<ApiResponse<{ deleted_count: number }>> {
    return apiClient['request']('DELETE', `${BASE}/pulse`);
  },
};
