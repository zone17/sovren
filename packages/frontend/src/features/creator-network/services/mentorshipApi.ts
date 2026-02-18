import apiClient from '@/services/api/apiClient';
import type { ApiResponse } from '../types/community';
import type { MentorProfile, Mentorship } from '@shared/types/community';

const BASE = '/api/v2/mentorship';

export const mentorshipApi = {
  registerMentor(data: {
    niche: string;
    audienceSizeRange: '0-1k' | '1k-10k' | '10k-100k' | '100k+';
    bio?: string;
    maxMentees?: number;
  }): Promise<ApiResponse<MentorProfile>> {
    return apiClient['request']('POST', `${BASE}/register-mentor`, data);
  },

  getMentors(params?: {
    niche?: string;
    audienceSizeRange?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<{ mentors: MentorProfile[]; total: number }>> {
    return apiClient['request']('GET', `${BASE}/mentors`, undefined, params);
  },

  requestMentorship(data: {
    mentorId: string;
    niche?: string;
    goals?: string[];
  }): Promise<ApiResponse<Mentorship>> {
    return apiClient['request']('POST', `${BASE}/request`, data);
  },

  respondToMentorship(
    id: string,
    data: { accept: boolean }
  ): Promise<ApiResponse<Mentorship>> {
    return apiClient['request']('PUT', `${BASE}/${id}/accept`, data);
  },

  getMyMentorships(): Promise<ApiResponse<{ mentorships: Mentorship[] }>> {
    return apiClient['request']('GET', `${BASE}/my-mentorships`);
  },
};
