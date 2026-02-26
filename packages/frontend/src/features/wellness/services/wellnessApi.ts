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
  WellnessBenchmark,
  WorkPatterns,
} from '../types';

const BASE = '/api/v2/wellness';

export const wellnessApi = {
  // -- Work Patterns --

  getPatterns(period: PatternPeriod = '7d'): Promise<ApiResponse<WorkPatterns>> {
    return apiClient.get(`${BASE}/patterns`, { period });
  },

  getHeatmap(period: HeatmapPeriod = '7d'): Promise<ApiResponse<HeatmapData>> {
    return apiClient.get(`${BASE}/patterns/heatmap`, { period });
  },

  // -- Burnout Risk --

  getRiskScore(): Promise<ApiResponse<BurnoutScore>> {
    return apiClient.get(`${BASE}/risk-score`);
  },

  updateSensitivity(sensitivity: Sensitivity): Promise<ApiResponse<{ sensitivity: Sensitivity; updated_at: string }>> {
    return apiClient.put(`${BASE}/risk-score/sensitivity`, { sensitivity });
  },

  // -- Schedule --

  getScheduleRecommendations(): Promise<ApiResponse<ScheduleRecommendations>> {
    return apiClient.get(`${BASE}/schedule/recommendations`);
  },

  // -- Boundaries --

  getBoundaries(): Promise<ApiResponse<BoundaryConfig>> {
    return apiClient.get(`${BASE}/boundaries`);
  },

  updateBoundaries(data: BoundaryUpdatePayload): Promise<ApiResponse<BoundaryConfig>> {
    return apiClient.put(`${BASE}/boundaries`, data);
  },

  // -- Pulse Check-Ins --

  submitPulse(data: PulseSubmission): Promise<ApiResponse<PulseCheckIn>> {
    return apiClient.post(`${BASE}/pulse`, data);
  },

  getPulseHistory(
    period: PulsePeriod = '90d',
    pagination?: { limit?: number; offset?: number }
  ): Promise<ApiResponse<PulseHistory & { total?: number; limit?: number; offset?: number }>> {
    return apiClient.get(`${BASE}/pulse/history`, {
      period,
      limit: pagination?.limit,
      offset: pagination?.offset,
    });
  },

  deletePulseHistory(): Promise<ApiResponse<{ deleted_count: number }>> {
    return apiClient.delete(`${BASE}/pulse`);
  },

  // -- Benchmarks --

  getBenchmarks(): Promise<ApiResponse<WellnessBenchmark | null>> {
    return apiClient.get(`${BASE}/benchmark`);
  },

  // -- Resource Library --
  // Removed: getResourceLibrary — no corresponding backend route (GET /resources) exists.
  // Re-add when backend implements the /api/v2/wellness/resources endpoint.
};
