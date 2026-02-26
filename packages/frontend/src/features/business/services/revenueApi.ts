import apiClient from '@/services/api/apiClient';
import type {
  ApiResponse,
  RevenueBreakdownEntry,
  RevenueRisk,
  CreateRevenueEntryPayload,
} from '../types';
import type { DiversificationGoal, RevenueEntry } from '@shared/types/finance';

const BASE = '/api/v2/business/revenue';

export const revenueApi = {
  getBreakdown(): Promise<ApiResponse<RevenueBreakdownEntry[]>> {
    return apiClient.get(`${BASE}/breakdown`);
  },

  getRisk(): Promise<ApiResponse<RevenueRisk>> {
    return apiClient.get(`${BASE}/risk`);
  },

  getGoals(): Promise<ApiResponse<DiversificationGoal>> {
    return apiClient.get(`${BASE}/goals`);
  },

  updateGoals(targets: Record<string, number>): Promise<ApiResponse<DiversificationGoal>> {
    return apiClient.put(`${BASE}/goals`, { targets });
  },

  addRevenueEntry(data: CreateRevenueEntryPayload): Promise<ApiResponse<RevenueEntry>> {
    return apiClient.post(BASE, data);
  },
};
