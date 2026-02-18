import apiClient from '@/services/api/apiClient';
import type { ApiResponse, RevenueBreakdownEntry, RevenueRisk, CreateRevenuEntryPayload } from '../types';
import type { DiversificationGoal, RevenueEntry } from '@shared/types/finance';

const BASE = '/api/v2/business/revenue';

export const revenueApi = {
  getBreakdown(): Promise<ApiResponse<RevenueBreakdownEntry[]>> {
    return apiClient['request']('GET', `${BASE}/breakdown`);
  },

  getRisk(): Promise<ApiResponse<RevenueRisk>> {
    return apiClient['request']('GET', `${BASE}/risk`);
  },

  getGoals(): Promise<ApiResponse<DiversificationGoal>> {
    return apiClient['request']('GET', `${BASE}/goals`);
  },

  updateGoals(
    targetDistribution: Record<string, number>
  ): Promise<ApiResponse<DiversificationGoal>> {
    return apiClient['request']('PUT', `${BASE}/goals`, { targetDistribution });
  },

  addRevenueEntry(data: CreateRevenuEntryPayload): Promise<ApiResponse<RevenueEntry>> {
    return apiClient['request']('POST', BASE, data);
  },
};
