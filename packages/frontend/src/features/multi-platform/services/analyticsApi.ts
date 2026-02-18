import apiClient from '@/services/api/apiClient';
import type { ApiResponse } from '../types';
import type {
  PlatformOverview,
  ContentComparison,
  PlatformROI,
} from '@sovren/shared/types/distribution';

const ANALYTICS_BASE = '/api/v2/analytics/cross-platform';

export const analyticsApi = {
  getOverview(): Promise<ApiResponse<PlatformOverview>> {
    return apiClient['request']('GET', `${ANALYTICS_BASE}/overview`);
  },

  getComparison(contentId: string): Promise<ApiResponse<ContentComparison[]>> {
    return apiClient['request']('GET', `${ANALYTICS_BASE}/comparison/${contentId}`);
  },

  getROI(): Promise<ApiResponse<PlatformROI[]>> {
    return apiClient['request']('GET', `${ANALYTICS_BASE}/roi`);
  },
};
