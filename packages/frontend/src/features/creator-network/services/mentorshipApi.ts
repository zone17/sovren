import apiClient from '@/services/api/apiClient';
import type { ApiResponse } from '../types/community';
import type { MentorProfile, Mentorship } from '@shared/types/community';

const BASE = '/api/v2/mentorship';

// #751: Data shape for updating an existing mentor profile
export interface UpdateMentorProfileData {
  niche?: string;
  audienceSizeRange?: '0-1k' | '1k-10k' | '10k-100k' | '100k+';
  bio?: string;
  maxMentees?: number;
  active?: boolean;
}

export const mentorshipApi = {
  registerMentor(data: {
    niche: string;
    audienceSizeRange: '0-1k' | '1k-10k' | '10k-100k' | '100k+';
    bio?: string;
    maxMentees?: number;
  }): Promise<ApiResponse<MentorProfile>> {
    return apiClient.post(`${BASE}/register-mentor`, data);
  },

  getMentors(params?: {
    niche?: string;
    audienceSizeRange?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<{ mentors: MentorProfile[]; total: number }>> {
    return apiClient.get(`${BASE}/mentors`, params);
  },

  requestMentorship(data: {
    mentorId: string;
    niche?: string;
    goals?: string[];
  }): Promise<ApiResponse<Mentorship>> {
    return apiClient.post(`${BASE}/request`, data);
  },

  respondToMentorship(id: string, data: { accept: boolean }): Promise<ApiResponse<Mentorship>> {
    return apiClient.put(`${BASE}/${id}/accept`, data);
  },

  getMyMentorships(): Promise<ApiResponse<{ mentorships: Mentorship[] }>> {
    return apiClient.get(`${BASE}/my-mentorships`);
  },

  /** PATCH /api/v2/mentorship/profile — update the current user's mentor profile (#751) */
  updateMentorProfile(data: UpdateMentorProfileData): Promise<ApiResponse<MentorProfile>> {
    return apiClient.patch(`${BASE}/profile`, data);
  },
};
