import apiClient from '@/services/api/apiClient';
import type { ApiResponse } from '../types/community';
import type { ContentCollaborator } from '@shared/types/community';

const BASE = '/api/v2/content';

export const collaborationApi = {
  inviteCollaborators(
    contentId: string,
    data: { collaborators: Array<{ creatorId: string; revenueSplitBps: number }> }
  ): Promise<ApiResponse<ContentCollaborator[]>> {
    return apiClient['request']('POST', `${BASE}/collaborate`, { contentId, ...data });
  },

  updateRevenueSplit(
    contentId: string,
    data: { splits: Array<{ creatorId: string; revenueSplitBps: number }> }
  ): Promise<ApiResponse<ContentCollaborator[]>> {
    return apiClient['request']('PUT', `${BASE}/${contentId}/revenue-split`, data);
  },

  getCollaborators(contentId: string): Promise<ApiResponse<{ collaborators: ContentCollaborator[] }>> {
    return apiClient['request']('GET', `${BASE}/${contentId}/collaborators`);
  },
};
