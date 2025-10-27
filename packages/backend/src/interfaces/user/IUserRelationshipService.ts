/**
 * User Relationship Service Interface
 * User Story: US-E5-022
 * Interface for managing social connections and relationships
 * Part of Epic 005 - Backend Service Layer Refactoring
 */

import type {
  UserRelationship,
  FollowRequest,
  UnfollowRequest,
  BlockRequest,
  UnblockRequest,
  MuteRequest,
  UnmuteRequest,
  FriendRequest,
  FriendRequestResponse,
  FollowerListResponse,
  FollowingListResponse,
  RelationshipStats,
  RelationshipRecommendation,
  BulkFollowRequest,
  BulkUnfollowRequest,
  BulkOperationResult,
  RelationshipPrivacySettings,
  RelationshipQueryOptions,
  MutualRelationshipResult,
  RelationshipValidationResult,
  ImportFollowsRequest,
  ExportFollowsResponse,
  RelationshipMetrics,
  PaginationOptions
} from '../../types/user-relationship';

/**
 * User Relationship Service Interface
 * Manages all social relationship operations with idempotency and event-driven architecture
 */
export interface IUserRelationshipService {
  // Follow/Unfollow Operations
  /**
   * Follow a user
   * @param request - Follow request with userId and targetUserId
   * @returns UserRelationship - Created or existing relationship
   * @throws Error if blocked or invalid
   */
  follow(request: FollowRequest): Promise<UserRelationship>;

  /**
   * Unfollow a user
   * @param request - Unfollow request with userId and targetUserId
   * @returns boolean - True if unfollowed, false if wasn't following
   */
  unfollow(request: UnfollowRequest): Promise<boolean>;

  /**
   * Check if user is following another user
   * @param userId - Source user ID
   * @param targetUserId - Target user ID
   * @returns boolean - True if following
   */
  isFollowing(userId: string, targetUserId: string): Promise<boolean>;

  // Block Operations
  /**
   * Block a user (cascades to remove follows and prevent interactions)
   * @param request - Block request with userId and targetUserId
   * @returns UserRelationship - Created block relationship
   */
  block(request: BlockRequest): Promise<UserRelationship>;

  /**
   * Unblock a user
   * @param request - Unblock request with userId and targetUserId
   * @returns boolean - True if unblocked, false if wasn't blocked
   */
  unblock(request: UnblockRequest): Promise<boolean>;

  /**
   * Check if user is blocking another user
   * @param userId - Source user ID
   * @param targetUserId - Target user ID
   * @returns boolean - True if blocking
   */
  isBlocking(userId: string, targetUserId: string): Promise<boolean>;

  /**
   * Check if user is blocked by another user
   * @param userId - User to check
   * @param targetUserId - Potential blocker
   * @returns boolean - True if blocked
   */
  isBlockedBy(userId: string, targetUserId: string): Promise<boolean>;

  // Mute Operations
  /**
   * Mute a user (hide content without blocking)
   * @param request - Mute request with userId, targetUserId, and optional duration
   * @returns UserRelationship - Created mute relationship
   */
  mute(request: MuteRequest): Promise<UserRelationship>;

  /**
   * Unmute a user
   * @param request - Unmute request with userId and targetUserId
   * @returns boolean - True if unmuted, false if wasn't muted
   */
  unmute(request: UnmuteRequest): Promise<boolean>;

  /**
   * Check if user is muting another user
   * @param userId - Source user ID
   * @param targetUserId - Target user ID
   * @returns boolean - True if muting
   */
  isMuting(userId: string, targetUserId: string): Promise<boolean>;

  // Friend Request Operations
  /**
   * Send a friend request (for private accounts)
   * @param request - Friend request with userId, targetUserId, and optional message
   * @returns UserRelationship - Created friend request
   */
  sendFriendRequest(request: FriendRequest): Promise<UserRelationship>;

  /**
   * Respond to a friend request
   * @param response - Response with requestId, userId, and accepted status
   * @returns UserRelationship - Updated relationship
   */
  respondToFriendRequest(response: FriendRequestResponse): Promise<UserRelationship>;

  /**
   * Cancel a sent friend request
   * @param requestId - Friend request ID
   * @param userId - User who sent the request
   * @returns boolean - True if cancelled
   */
  cancelFriendRequest(requestId: string, userId: string): Promise<boolean>;

  /**
   * Get pending friend requests for a user
   * @param userId - User ID
   * @param pagination - Pagination options
   * @returns Array of pending friend requests
   */
  getPendingFriendRequests(
    userId: string,
    pagination?: PaginationOptions
  ): Promise<UserRelationship[]>;

  // List Operations
  /**
   * Get followers list for a user
   * @param userId - User ID
   * @param pagination - Pagination options
   * @returns FollowerListResponse with paginated followers
   */
  getFollowers(
    userId: string,
    pagination?: PaginationOptions
  ): Promise<FollowerListResponse>;

  /**
   * Get following list for a user
   * @param userId - User ID
   * @param pagination - Pagination options
   * @returns FollowingListResponse with paginated following
   */
  getFollowing(
    userId: string,
    pagination?: PaginationOptions
  ): Promise<FollowingListResponse>;

  /**
   * Get mutual follows (friends) for a user
   * @param userId - User ID
   * @param pagination - Pagination options
   * @returns Array of mutual relationships
   */
  getMutualFollows(
    userId: string,
    pagination?: PaginationOptions
  ): Promise<UserRelationship[]>;

  /**
   * Get blocked users list
   * @param userId - User ID
   * @param pagination - Pagination options
   * @returns Array of blocked relationships
   */
  getBlockedUsers(
    userId: string,
    pagination?: PaginationOptions
  ): Promise<UserRelationship[]>;

  /**
   * Get muted users list
   * @param userId - User ID
   * @param pagination - Pagination options
   * @returns Array of muted relationships
   */
  getMutedUsers(
    userId: string,
    pagination?: PaginationOptions
  ): Promise<UserRelationship[]>;

  // Statistics
  /**
   * Get relationship statistics for a user
   * @param userId - User ID
   * @returns RelationshipStats with counts
   */
  getRelationshipStats(userId: string): Promise<RelationshipStats>;

  /**
   * Check if two users have a mutual follow relationship
   * @param userId - First user ID
   * @param targetUserId - Second user ID
   * @returns MutualRelationshipResult with mutual status
   */
  checkMutualRelationship(
    userId: string,
    targetUserId: string
  ): Promise<MutualRelationshipResult>;

  // Recommendations
  /**
   * Get recommended users to follow
   * @param userId - User ID requesting recommendations
   * @param limit - Maximum number of recommendations
   * @returns Array of recommendations with scores
   */
  getRecommendations(
    userId: string,
    limit?: number
  ): Promise<RelationshipRecommendation[]>;

  // Bulk Operations
  /**
   * Follow multiple users in bulk
   * @param request - Bulk follow request with userId and targetUserIds
   * @returns BulkOperationResult with success/failure details
   */
  bulkFollow(request: BulkFollowRequest): Promise<BulkOperationResult>;

  /**
   * Unfollow multiple users in bulk
   * @param request - Bulk unfollow request with userId and targetUserIds
   * @returns BulkOperationResult with success/failure details
   */
  bulkUnfollow(request: BulkUnfollowRequest): Promise<BulkOperationResult>;

  // Privacy Settings
  /**
   * Get privacy settings for a user
   * @param userId - User ID
   * @returns RelationshipPrivacySettings
   */
  getPrivacySettings(userId: string): Promise<RelationshipPrivacySettings>;

  /**
   * Update privacy settings for a user
   * @param userId - User ID
   * @param settings - Updated privacy settings
   * @returns Updated RelationshipPrivacySettings
   */
  updatePrivacySettings(
    userId: string,
    settings: Partial<RelationshipPrivacySettings>
  ): Promise<RelationshipPrivacySettings>;

  // Validation
  /**
   * Validate relationship between two users
   * @param userId - Source user ID
   * @param targetUserId - Target user ID
   * @returns RelationshipValidationResult with all relationship states
   */
  validateRelationship(
    userId: string,
    targetUserId: string
  ): Promise<RelationshipValidationResult>;

  // Import/Export
  /**
   * Import follows from external source
   * @param request - Import request with userId and userIds
   * @returns BulkOperationResult with import results
   */
  importFollows(request: ImportFollowsRequest): Promise<BulkOperationResult>;

  /**
   * Export all relationship data for a user
   * @param userId - User ID
   * @returns ExportFollowsResponse with all relationship data
   */
  exportRelationships(userId: string): Promise<ExportFollowsResponse>;

  // Query
  /**
   * Query relationships with filters
   * @param options - Query options with filters and pagination
   * @returns Array of matching relationships
   */
  queryRelationships(options: RelationshipQueryOptions): Promise<UserRelationship[]>;

  // Metrics
  /**
   * Get global relationship metrics
   * @returns RelationshipMetrics with system-wide statistics
   */
  getMetrics(): Promise<RelationshipMetrics>;

  // Health & Maintenance
  /**
   * Clean up expired relationships (mutes, temporary blocks)
   * @returns Number of relationships cleaned up
   */
  cleanupExpiredRelationships(): Promise<number>;

  /**
   * Rebuild relationship graph cache
   * @returns boolean - True if successful
   */
  rebuildCache(): Promise<boolean>;

  /**
   * Health check for the service
   * @returns boolean - True if healthy
   */
  healthCheck(): Promise<boolean>;

  /**
   * Dispose of service resources
   */
  dispose(): Promise<void>;
}
