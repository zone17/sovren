import apiClient from '@/services/api/apiClient';
import type { ApiResponse, CircleWithMemberCount } from '../types/community';
import type { Circle, CircleMember, CirclePost } from '@shared/types/community';

const BASE = '/api/v2/circles';

export const circlesApi = {
  createCircle(data: {
    name: string;
    description?: string;
    niche?: string;
    maxMembers?: number;
  }): Promise<ApiResponse<Circle>> {
    return apiClient.post(BASE, data);
  },

  getCircles(): Promise<ApiResponse<{ circles: CircleWithMemberCount[] }>> {
    return apiClient.get(BASE);
  },

  getSuggestedCircles(): Promise<ApiResponse<{ circles: CircleWithMemberCount[] }>> {
    return apiClient.get(`${BASE}/suggested`);
  },

  joinCircle(circleId: string): Promise<ApiResponse<CircleMember>> {
    return apiClient.post(`${BASE}/${circleId}/join`);
  },

  getCircleById(circleId: string): Promise<ApiResponse<CircleWithMemberCount>> {
    return apiClient.get(`${BASE}/${circleId}`);
  },

  leaveCircle(circleId: string): Promise<ApiResponse<void>> {
    return apiClient.delete(`${BASE}/${circleId}/leave`);
  },

  removeMember(circleId: string, memberId: string): Promise<ApiResponse<void>> {
    return apiClient.delete(`${BASE}/${circleId}/members/${memberId}`);
  },

  getCirclePosts(
    circleId: string,
    params?: { page?: number; limit?: number }
  ): Promise<ApiResponse<{ posts: CirclePost[]; total: number }>> {
    return apiClient.get(`${BASE}/${circleId}/posts`, params);
  },

  postToCircle(circleId: string, data: { content: string }): Promise<ApiResponse<CirclePost>> {
    return apiClient.post(`${BASE}/${circleId}/posts`, data);
  },
};
