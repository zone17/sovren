import apiClient from '@/services/api/apiClient';
import type { ApiResponse } from '../types/community';
import type { ContentCollaborator } from '@shared/types/community';

const BASE = '/api/v2/content';

export const collaborationApi = {
  /** #312: Backend expects flat shape per collaborator, not an array. Send one request each. */
  inviteCollaborator(
    contentId: string,
    collaboratorId: string,
    revenueSplitBps: number
  ): Promise<ApiResponse<ContentCollaborator>> {
    return apiClient.post(`${BASE}/collaborate`, {
      contentId,
      collaboratorId,
      revenueSplitBps,
    });
  },

  /** #311: Backend UpdateRevenueSplitSchema expects { splits: [{ creatorId, bps }] } */
  updateRevenueSplit(
    contentId: string,
    data: { splits: Array<{ creatorId: string; bps: number }> }
  ): Promise<ApiResponse<ContentCollaborator[]>> {
    return apiClient.put(`${BASE}/${contentId}/revenue-split`, data);
  },

  getCollaborators(
    contentId: string
  ): Promise<ApiResponse<{ collaborators: ContentCollaborator[] }>> {
    return apiClient.get(`${BASE}/${contentId}/collaborators`);
  },

  /** #313: Backend route PUT /collaborations/:id/respond with { accept: boolean } */
  respondToInvitation(
    invitationId: string,
    accept: boolean
  ): Promise<ApiResponse<{ accepted: boolean }>> {
    return apiClient.put(`${BASE}/collaborations/${invitationId}/respond`, {
      accept,
    });
  },
};
