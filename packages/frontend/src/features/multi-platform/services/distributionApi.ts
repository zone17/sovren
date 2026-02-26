import apiClient from '@/services/api/apiClient';
import type {
  ApiResponse,
  BatchActionPayload,
  PublishPayload,
  RepurposePayload,
  ReplyPayload,
} from '../types';
import type {
  PlatformStatus,
  CrossPostEntry,
  RepurposedContent,
  InboxMessage,
  DistributionPagination,
  PlatformOverview,
  ContentComparison,
  PlatformROI,
} from '@sovren/shared/types/distribution';

const PLATFORMS_BASE = '/api/v2/platforms';
const DISTRIBUTE_BASE = '/api/v2/distribute';
const INBOX_BASE = '/api/v2/inbox';
const ANALYTICS_BASE = '/api/v2/analytics/cross-platform';

export const distributionApi = {
  // -- Platform Connections --

  connectPlatform(platform: string): Promise<ApiResponse<{ authorization_url: string }>> {
    return apiClient.post(`${PLATFORMS_BASE}/connect/${platform}`);
  },

  disconnectPlatform(platform: string): Promise<ApiResponse<{ disconnected: boolean }>> {
    return apiClient.delete(`${PLATFORMS_BASE}/disconnect/${platform}`);
  },

  getPlatformStatus(): Promise<ApiResponse<PlatformStatus[]>> {
    return apiClient.get(`${PLATFORMS_BASE}/status`);
  },

  // -- Publishing & Cross-Posting --

  publish(data: PublishPayload): Promise<ApiResponse<{ platforms: CrossPostEntry[] }>> {
    return apiClient.post(`${DISTRIBUTE_BASE}/publish`, data);
  },

  getPublishStatus(contentId: string): Promise<ApiResponse<CrossPostEntry[]>> {
    return apiClient.get(`${DISTRIBUTE_BASE}/status/${contentId}`);
  },

  // -- Content Repurposing --

  repurpose(data: RepurposePayload): Promise<ApiResponse<RepurposedContent[]>> {
    return apiClient.post(`${DISTRIBUTE_BASE}/repurpose`, data);
  },

  getRepurposed(contentId: string): Promise<ApiResponse<RepurposedContent[]>> {
    return apiClient.get(`${DISTRIBUTE_BASE}/repurposed/${contentId}`);
  },

  approveRepurposed(id: string): Promise<ApiResponse<RepurposedContent>> {
    return apiClient.put(`${DISTRIBUTE_BASE}/repurposed/${id}/approve`);
  },

  // -- Unified Inbox --

  getInboxMessages(params: {
    platform?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<{ messages: InboxMessage[]; pagination: DistributionPagination }>> {
    return apiClient.get(`${INBOX_BASE}/messages`, params);
  },

  replyToMessage(messageId: string, data: ReplyPayload): Promise<ApiResponse<void>> {
    return apiClient.post(`${INBOX_BASE}/reply/${messageId}`, data);
  },

  batchAction(data: BatchActionPayload): Promise<ApiResponse<{ affected: number }>> {
    return apiClient.put(`${INBOX_BASE}/batch`, data);
  },

  // -- Cross-Platform Analytics --

  getAnalyticsOverview(): Promise<ApiResponse<PlatformOverview>> {
    return apiClient.get(`${ANALYTICS_BASE}/overview`);
  },

  getContentComparison(contentId: string): Promise<ApiResponse<ContentComparison[]>> {
    return apiClient.get(`${ANALYTICS_BASE}/comparison/${contentId}`);
  },

  getROI(): Promise<ApiResponse<PlatformROI[]>> {
    return apiClient.get(`${ANALYTICS_BASE}/roi`);
  },
};
