/**
 * User Relationship Types
 * User Story: US-E5-022
 * Comprehensive types for social relationship management
 * Part of Epic 005 - Backend Service Layer Refactoring
 */

/**
 * Relationship types between users
 */
export enum RelationshipType {
  FOLLOW = 'follow',
  BLOCK = 'block',
  MUTE = 'mute',
  FRIEND_REQUEST = 'friend_request'
}

/**
 * Relationship status
 */
export enum RelationshipStatus {
  ACTIVE = 'active',
  PENDING = 'pending',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled'
}

/**
 * User relationship entity
 */
export interface UserRelationship {
  id: string;
  sourceUserId: string;
  targetUserId: string;
  type: RelationshipType;
  status: RelationshipStatus;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

/**
 * Follow request
 */
export interface FollowRequest {
  userId: string;
  targetUserId: string;
  force?: boolean; // Force follow even if blocked
  metadata?: Record<string, any>;
}

/**
 * Unfollow request
 */
export interface UnfollowRequest {
  userId: string;
  targetUserId: string;
}

/**
 * Block request
 */
export interface BlockRequest {
  userId: string;
  targetUserId: string;
  reason?: string;
  metadata?: Record<string, any>;
}

/**
 * Unblock request
 */
export interface UnblockRequest {
  userId: string;
  targetUserId: string;
}

/**
 * Mute request
 */
export interface MuteRequest {
  userId: string;
  targetUserId: string;
  duration?: number; // Duration in seconds, undefined = permanent
  metadata?: Record<string, any>;
}

/**
 * Unmute request
 */
export interface UnmuteRequest {
  userId: string;
  targetUserId: string;
}

/**
 * Friend request
 */
export interface FriendRequest {
  userId: string;
  targetUserId: string;
  message?: string;
  metadata?: Record<string, any>;
}

/**
 * Friend request response
 */
export interface FriendRequestResponse {
  requestId: string;
  userId: string;
  accepted: boolean;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  limit?: number;
  offset?: number;
  cursor?: string;
}

/**
 * Follower list response
 */
export interface FollowerListResponse {
  followers: UserRelationshipInfo[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

/**
 * Following list response
 */
export interface FollowingListResponse {
  following: UserRelationshipInfo[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

/**
 * User relationship info (enriched with user data)
 */
export interface UserRelationshipInfo {
  userId: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  relationship: UserRelationship;
  isMutual?: boolean;
}

/**
 * Relationship statistics
 */
export interface RelationshipStats {
  followerCount: number;
  followingCount: number;
  mutualFollowCount: number;
  blockedCount: number;
  mutedCount: number;
  pendingRequestCount: number;
}

/**
 * Relationship recommendation
 */
export interface RelationshipRecommendation {
  userId: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  score: number;
  reason: string;
  mutualFollowers: number;
  commonInterests?: string[];
}

/**
 * Bulk follow request
 */
export interface BulkFollowRequest {
  userId: string;
  targetUserIds: string[];
  batchSize?: number;
  delayMs?: number;
}

/**
 * Bulk unfollow request
 */
export interface BulkUnfollowRequest {
  userId: string;
  targetUserIds: string[];
  batchSize?: number;
  delayMs?: number;
}

/**
 * Bulk operation result
 */
export interface BulkOperationResult {
  successful: string[];
  failed: Array<{ userId: string; error: string }>;
  total: number;
  successCount: number;
  failureCount: number;
}

/**
 * Privacy settings for relationships
 */
export interface RelationshipPrivacySettings {
  userId: string;
  hideFollowers: boolean;
  hideFollowing: boolean;
  requireApprovalForFollows: boolean;
  allowFriendRequests: boolean;
  allowMessages: boolean;
}

/**
 * Relationship query options
 */
export interface RelationshipQueryOptions {
  userId: string;
  type?: RelationshipType;
  status?: RelationshipStatus;
  includeExpired?: boolean;
  sortBy?: 'createdAt' | 'updatedAt' | 'username';
  sortOrder?: 'asc' | 'desc';
  pagination?: PaginationOptions;
}

/**
 * Mutual relationship check result
 */
export interface MutualRelationshipResult {
  userId: string;
  targetUserId: string;
  isMutual: boolean;
  sourceRelationship?: UserRelationship;
  targetRelationship?: UserRelationship;
}

/**
 * Relationship validation result
 */
export interface RelationshipValidationResult {
  valid: boolean;
  canFollow: boolean;
  canMessage: boolean;
  canViewProfile: boolean;
  isBlocked: boolean;
  isBlockedBy: boolean;
  isMuted: boolean;
  isMutedBy: boolean;
  isFollowing: boolean;
  isFollowedBy: boolean;
  requiresApproval: boolean;
}

/**
 * Relationship event payload
 */
export interface RelationshipEventPayload {
  sourceUserId: string;
  targetUserId: string;
  type: RelationshipType;
  status: RelationshipStatus;
  metadata?: Record<string, any>;
}

/**
 * Relationship filter options
 */
export interface RelationshipFilterOptions {
  types?: RelationshipType[];
  statuses?: RelationshipStatus[];
  createdAfter?: Date;
  createdBefore?: Date;
  excludeExpired?: boolean;
}

/**
 * Import follows request
 */
export interface ImportFollowsRequest {
  userId: string;
  userIds: string[];
  source: string; // e.g., 'twitter', 'nostr', 'manual'
  metadata?: Record<string, any>;
}

/**
 * Export follows response
 */
export interface ExportFollowsResponse {
  userId: string;
  followers: string[];
  following: string[];
  blocked: string[];
  muted: string[];
  exportedAt: Date;
}

/**
 * Relationship graph node
 */
export interface RelationshipGraphNode {
  userId: string;
  followers: Set<string>;
  following: Set<string>;
  blocked: Set<string>;
  muted: Set<string>;
}

/**
 * Relationship metrics
 */
export interface RelationshipMetrics {
  totalRelationships: number;
  activeFollows: number;
  activeBlocks: number;
  activeMutes: number;
  pendingRequests: number;
  mutualFollows: number;
  avgFollowersPerUser: number;
  avgFollowingPerUser: number;
}
