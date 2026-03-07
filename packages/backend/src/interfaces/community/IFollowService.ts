/**
 * IFollowService — Focused follow relationship interface
 * Slice 8: Creator Network + Notifications
 *
 * Intentionally narrow (6 methods) — does NOT extend IUserRelationshipService
 * which is a 314-line God Interface with @ts-nocheck.
 */

import type { FollowRelationship, FollowCounts } from '@shared/types/community';

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
}

export interface IFollowService {
  /**
   * Follow a user. Throws ConflictError if already following.
   * Throws ValidationError if followerId === followingId.
   */
  follow(followerId: string, followingId: string): Promise<{ id: string }>;

  /**
   * Unfollow a user. No-op if not following (idempotent).
   */
  unfollow(followerId: string, followingId: string): Promise<void>;

  /**
   * Check if followerId is currently following followingId.
   */
  isFollowing(followerId: string, followingId: string): Promise<boolean>;

  /**
   * List users who follow the given userId.
   */
  getFollowers(userId: string, opts: PaginationParams): Promise<PaginatedResult<FollowRelationship>>;

  /**
   * List users that the given userId is following.
   */
  getFollowing(userId: string, opts: PaginationParams): Promise<PaginatedResult<FollowRelationship>>;

  /**
   * Get follower/following counts for a user.
   */
  getFollowCounts(userId: string): Promise<FollowCounts>;
}
