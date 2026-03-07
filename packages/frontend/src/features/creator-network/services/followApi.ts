/**
 * Follow API Service
 * Slice 8: Creator Network + Notifications
 *
 * Domain-scoped API service following the commentsApi.ts pattern.
 */

import apiClient from '@/services/api/apiClient';
import type { FollowCounts, FollowRelationship } from '@shared/types/community';

const BASE = '/api/v2/network/users';

export const followApi = {
  /** POST /api/v2/network/users/:userId/follow — follow a creator */
  follow(userId: string): Promise<FollowRelationship> {
    return apiClient.post(`${BASE}/${userId}/follow`);
  },

  /** DELETE /api/v2/network/users/:userId/follow — unfollow a creator */
  unfollow(userId: string): Promise<void> {
    return apiClient.delete(`${BASE}/${userId}/follow`);
  },

  /** GET /api/v2/network/users/:userId/follow-status — check if current user follows userId */
  isFollowing(userId: string): Promise<{ following: boolean }> {
    return apiClient.get(`${BASE}/${userId}/follow-status`);
  },

  /** GET /api/v2/network/users/:userId/followers — paginated list of userId's followers */
  getFollowers(
    userId: string,
    params?: { page?: number; limit?: number }
  ): Promise<{ followers: FollowRelationship[]; total: number }> {
    return apiClient.get(`${BASE}/${userId}/followers`, params as Record<string, number | undefined>);
  },

  /** GET /api/v2/network/users/:userId/following — paginated list of creators userId follows */
  getFollowing(
    userId: string,
    params?: { page?: number; limit?: number }
  ): Promise<{ following: FollowRelationship[]; total: number }> {
    return apiClient.get(`${BASE}/${userId}/following`, params as Record<string, number | undefined>);
  },

  /** GET /api/v2/network/users/:userId/follow-counts — follower/following counts for userId */
  getFollowCounts(userId: string): Promise<FollowCounts> {
    return apiClient.get(`${BASE}/${userId}/follow-counts`);
  },
};
