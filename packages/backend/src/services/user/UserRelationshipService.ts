/**
 * User Relationship Service Implementation
 * User Story: US-E5-022
 * Comprehensive social relationship management with event-driven architecture
 * Part of Epic 005 - Backend Service Layer Refactoring
 */

import type { IUserRelationshipService } from '../../interfaces/user/IUserRelationshipService';
import type {
  IEventBus
} from '../../interfaces/shared/IEventBus';
import {
  DomainEventType,
} from '../../interfaces/shared/IEventBus';
import type { ILogger } from '../../interfaces/shared/ILogger';
import type { ICacheService } from '../../interfaces/shared/ICacheService';
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
  PaginationOptions,
  RelationshipGraphNode,
  UserRelationshipInfo
} from '../../types/user-relationship';
import {
  RelationshipType,
  RelationshipStatus,
} from '../../types/user-relationship';

import { DomainEventBuilder, DomainEventType as EventType } from '../../interfaces/shared/IEventBus';
import crypto, { createHash } from 'crypto';

/**
 * In-memory relationship graph for efficient bidirectional queries
 */
class RelationshipGraph {
  private nodes: Map<string, RelationshipGraphNode> = new Map();

  getNode(userId: string): RelationshipGraphNode {
    if (!this.nodes.has(userId)) {
      this.nodes.set(userId, {
        userId,
        followers: new Set(),
        following: new Set(),
        blocked: new Set(),
        muted: new Set()
      });
    }
    return this.nodes.get(userId)!;
  }

  addFollow(sourceUserId: string, targetUserId: string): void {
    const sourceNode = this.getNode(sourceUserId);
    const targetNode = this.getNode(targetUserId);

    sourceNode.following.add(targetUserId);
    targetNode.followers.add(sourceUserId);
  }

  removeFollow(sourceUserId: string, targetUserId: string): void {
    const sourceNode = this.getNode(sourceUserId);
    const targetNode = this.getNode(targetUserId);

    sourceNode.following.delete(targetUserId);
    targetNode.followers.delete(sourceUserId);
  }

  addBlock(sourceUserId: string, targetUserId: string): void {
    const sourceNode = this.getNode(sourceUserId);
    sourceNode.blocked.add(targetUserId);
  }

  removeBlock(sourceUserId: string, targetUserId: string): void {
    const sourceNode = this.getNode(sourceUserId);
    sourceNode.blocked.delete(targetUserId);
  }

  addMute(sourceUserId: string, targetUserId: string): void {
    const sourceNode = this.getNode(sourceUserId);
    sourceNode.muted.add(targetUserId);
  }

  removeMute(sourceUserId: string, targetUserId: string): void {
    const sourceNode = this.getNode(sourceUserId);
    sourceNode.muted.delete(targetUserId);
  }

  isFollowing(sourceUserId: string, targetUserId: string): boolean {
    const node = this.nodes.get(sourceUserId);
    return node ? node.following.has(targetUserId) : false;
  }

  isBlocking(sourceUserId: string, targetUserId: string): boolean {
    const node = this.nodes.get(sourceUserId);
    return node ? node.blocked.has(targetUserId) : false;
  }

  isMuting(sourceUserId: string, targetUserId: string): boolean {
    const node = this.nodes.get(sourceUserId);
    return node ? node.muted.has(targetUserId) : false;
  }

  getFollowers(userId: string): string[] {
    const node = this.nodes.get(userId);
    return node ? Array.from(node.followers) : [];
  }

  getFollowing(userId: string): string[] {
    const node = this.nodes.get(userId);
    return node ? Array.from(node.following) : [];
  }

  getMutualFollows(userId: string): string[] {
    const node = this.nodes.get(userId);
    if (!node) return [];

    return Array.from(node.following).filter(targetId => {
      const targetNode = this.nodes.get(targetId);
      return targetNode && targetNode.following.has(userId);
    });
  }

  clear(): void {
    this.nodes.clear();
  }
}

/**
 * UserRelationshipService implementation
 */
export class UserRelationshipService implements IUserRelationshipService {
  private readonly eventBus: IEventBus;
  private readonly logger: ILogger;
  private readonly cache?: ICacheService;

  // In-memory storage (in production, would use database)
  private readonly relationships: Map<string, UserRelationship> = new Map();
  private readonly graph: RelationshipGraph = new RelationshipGraph();
  private readonly privacySettings: Map<string, RelationshipPrivacySettings> = new Map();

  // Rate limiting tracking
  private readonly operationCounts: Map<string, { count: number; resetAt: Date }> = new Map();
  private readonly MAX_OPERATIONS_PER_HOUR = 100;

  // Metrics
  private metrics: RelationshipMetrics = {
    totalRelationships: 0,
    activeFollows: 0,
    activeBlocks: 0,
    activeMutes: 0,
    pendingRequests: 0,
    mutualFollows: 0,
    avgFollowersPerUser: 0,
    avgFollowingPerUser: 0
  };

  constructor(
    eventBus: IEventBus,
    logger: ILogger,
    cache?: ICacheService
  ) {
    this.eventBus = eventBus;
    this.logger = logger;
    this.cache = cache;

    // Start periodic cleanup
    setInterval(() => this.cleanupExpiredRelationships(), 60000); // Every minute
  }

  // ============================================================================
  // Follow/Unfollow Operations
  // ============================================================================

  async follow(request: FollowRequest): Promise<UserRelationship> {
    this.logger.debug('Follow request', { request });

    // Validate request
    this.validateUserIds(request.userId, request.targetUserId);

    // Check rate limiting
    await this.checkRateLimit(request.userId, 'follow');

    // Check if already following (idempotent)
    const existing = this.findRelationship(
      request.userId,
      request.targetUserId,
      RelationshipType.FOLLOW
    );

    if (existing && existing.status === RelationshipStatus.ACTIVE) {
      this.logger.debug('Already following', { existing });
      return existing;
    }

    // Check if blocked
    if (!request.force) {
      const validation = await this.validateRelationship(request.userId, request.targetUserId);

      if (validation.isBlocked) {
        throw new Error('Cannot follow: you have blocked this user');
      }

      if (validation.isBlockedBy) {
        throw new Error('Cannot follow: you are blocked by this user');
      }
    }

    // Check privacy settings
    const targetPrivacy = await this.getPrivacySettings(request.targetUserId);

    const relationship: UserRelationship = {
      id: this.generateId(),
      sourceUserId: request.userId,
      targetUserId: request.targetUserId,
      type: RelationshipType.FOLLOW,
      status: targetPrivacy.requireApprovalForFollows
        ? RelationshipStatus.PENDING
        : RelationshipStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: request.metadata
    };

    // Store relationship
    this.relationships.set(relationship.id, relationship);

    // Update graph if active
    if (relationship.status === RelationshipStatus.ACTIVE) {
      this.graph.addFollow(request.userId, request.targetUserId);
      this.metrics.activeFollows++;
    } else {
      this.metrics.pendingRequests++;
    }

    this.metrics.totalRelationships++;

    // Invalidate caches
    await this.invalidateCaches(request.userId, request.targetUserId);

    // Emit event
    await this.emitRelationshipEvent('user.followed', relationship);

    this.logger.info('User followed', { relationship });

    return relationship;
  }

  async unfollow(request: UnfollowRequest): Promise<boolean> {
    this.logger.debug('Unfollow request', { request });

    this.validateUserIds(request.userId, request.targetUserId);

    const relationship = this.findRelationship(
      request.userId,
      request.targetUserId,
      RelationshipType.FOLLOW
    );

    if (!relationship || relationship.status !== RelationshipStatus.ACTIVE) {
      return false;
    }

    // Remove relationship
    this.relationships.delete(relationship.id);
    this.graph.removeFollow(request.userId, request.targetUserId);
    this.metrics.activeFollows--;
    this.metrics.totalRelationships--;

    // Invalidate caches
    await this.invalidateCaches(request.userId, request.targetUserId);

    // Emit event
    await this.emitRelationshipEvent('user.unfollowed', relationship);

    this.logger.info('User unfollowed', { relationship });

    return true;
  }

  async isFollowing(userId: string, targetUserId: string): Promise<boolean> {
    // Check cache first
    if (this.cache) {
      const cached = await this.cache.get<boolean>(
        `relationship:following:${userId}:${targetUserId}`
      );
      if (cached !== null) return cached;
    }

    const result = this.graph.isFollowing(userId, targetUserId);

    // Cache result
    if (this.cache) {
      await this.cache.set(
        `relationship:following:${userId}:${targetUserId}`,
        result,
        3600 // 1 hour
      );
    }

    return result;
  }

  // ============================================================================
  // Block Operations
  // ============================================================================

  async block(request: BlockRequest): Promise<UserRelationship> {
    this.logger.debug('Block request', { request });

    this.validateUserIds(request.userId, request.targetUserId);

    await this.checkRateLimit(request.userId, 'block');

    // Check if already blocking (idempotent)
    const existing = this.findRelationship(
      request.userId,
      request.targetUserId,
      RelationshipType.BLOCK
    );

    if (existing && existing.status === RelationshipStatus.ACTIVE) {
      return existing;
    }

    // Cascade: Remove follow relationships
    await this.unfollow({ userId: request.userId, targetUserId: request.targetUserId });
    await this.unfollow({ userId: request.targetUserId, targetUserId: request.userId });

    const relationship: UserRelationship = {
      id: this.generateId(),
      sourceUserId: request.userId,
      targetUserId: request.targetUserId,
      type: RelationshipType.BLOCK,
      status: RelationshipStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: { ...request.metadata, reason: request.reason }
    };

    this.relationships.set(relationship.id, relationship);
    this.graph.addBlock(request.userId, request.targetUserId);
    this.metrics.activeBlocks++;
    this.metrics.totalRelationships++;

    await this.invalidateCaches(request.userId, request.targetUserId);

    await this.emitRelationshipEvent('user.blocked', relationship);

    this.logger.info('User blocked', { relationship });

    return relationship;
  }

  async unblock(request: UnblockRequest): Promise<boolean> {
    this.logger.debug('Unblock request', { request });

    this.validateUserIds(request.userId, request.targetUserId);

    const relationship = this.findRelationship(
      request.userId,
      request.targetUserId,
      RelationshipType.BLOCK
    );

    if (!relationship || relationship.status !== RelationshipStatus.ACTIVE) {
      return false;
    }

    this.relationships.delete(relationship.id);
    this.graph.removeBlock(request.userId, request.targetUserId);
    this.metrics.activeBlocks--;
    this.metrics.totalRelationships--;

    await this.invalidateCaches(request.userId, request.targetUserId);

    await this.emitRelationshipEvent('user.unblocked', relationship);

    this.logger.info('User unblocked', { relationship });

    return true;
  }

  async isBlocking(userId: string, targetUserId: string): Promise<boolean> {
    if (this.cache) {
      const cached = await this.cache.get<boolean>(
        `relationship:blocking:${userId}:${targetUserId}`
      );
      if (cached !== null) return cached;
    }

    const result = this.graph.isBlocking(userId, targetUserId);

    if (this.cache) {
      await this.cache.set(
        `relationship:blocking:${userId}:${targetUserId}`,
        result,
        3600
      );
    }

    return result;
  }

  async isBlockedBy(userId: string, targetUserId: string): Promise<boolean> {
    return this.isBlocking(targetUserId, userId);
  }

  // ============================================================================
  // Mute Operations
  // ============================================================================

  async mute(request: MuteRequest): Promise<UserRelationship> {
    this.logger.debug('Mute request', { request });

    this.validateUserIds(request.userId, request.targetUserId);

    await this.checkRateLimit(request.userId, 'mute');

    const existing = this.findRelationship(
      request.userId,
      request.targetUserId,
      RelationshipType.MUTE
    );

    if (existing && existing.status === RelationshipStatus.ACTIVE) {
      return existing;
    }

    const expiresAt = request.duration
      ? new Date(Date.now() + request.duration * 1000)
      : undefined;

    const relationship: UserRelationship = {
      id: this.generateId(),
      sourceUserId: request.userId,
      targetUserId: request.targetUserId,
      type: RelationshipType.MUTE,
      status: RelationshipStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt,
      metadata: request.metadata
    };

    this.relationships.set(relationship.id, relationship);
    this.graph.addMute(request.userId, request.targetUserId);
    this.metrics.activeMutes++;
    this.metrics.totalRelationships++;

    await this.invalidateCaches(request.userId, request.targetUserId);

    await this.emitRelationshipEvent('user.muted', relationship);

    this.logger.info('User muted', { relationship });

    return relationship;
  }

  async unmute(request: UnmuteRequest): Promise<boolean> {
    this.logger.debug('Unmute request', { request });

    this.validateUserIds(request.userId, request.targetUserId);

    const relationship = this.findRelationship(
      request.userId,
      request.targetUserId,
      RelationshipType.MUTE
    );

    if (!relationship || relationship.status !== RelationshipStatus.ACTIVE) {
      return false;
    }

    this.relationships.delete(relationship.id);
    this.graph.removeMute(request.userId, request.targetUserId);
    this.metrics.activeMutes--;
    this.metrics.totalRelationships--;

    await this.invalidateCaches(request.userId, request.targetUserId);

    await this.emitRelationshipEvent('user.unmuted', relationship);

    this.logger.info('User unmuted', { relationship });

    return true;
  }

  async isMuting(userId: string, targetUserId: string): Promise<boolean> {
    if (this.cache) {
      const cached = await this.cache.get<boolean>(
        `relationship:muting:${userId}:${targetUserId}`
      );
      if (cached !== null) return cached;
    }

    const result = this.graph.isMuting(userId, targetUserId);

    if (this.cache) {
      await this.cache.set(
        `relationship:muting:${userId}:${targetUserId}`,
        result,
        3600
      );
    }

    return result;
  }

  // ============================================================================
  // Friend Request Operations
  // ============================================================================

  async sendFriendRequest(request: FriendRequest): Promise<UserRelationship> {
    this.logger.debug('Friend request sent', { request });

    this.validateUserIds(request.userId, request.targetUserId);

    await this.checkRateLimit(request.userId, 'friendRequest');

    // Check privacy settings
    const targetPrivacy = await this.getPrivacySettings(request.targetUserId);
    if (!targetPrivacy.allowFriendRequests) {
      throw new Error('User does not accept friend requests');
    }

    // Check for existing request
    const existing = this.findRelationship(
      request.userId,
      request.targetUserId,
      RelationshipType.FRIEND_REQUEST
    );

    if (existing && existing.status === RelationshipStatus.PENDING) {
      return existing;
    }

    const relationship: UserRelationship = {
      id: this.generateId(),
      sourceUserId: request.userId,
      targetUserId: request.targetUserId,
      type: RelationshipType.FRIEND_REQUEST,
      status: RelationshipStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: { ...request.metadata, message: request.message }
    };

    this.relationships.set(relationship.id, relationship);
    this.metrics.pendingRequests++;
    this.metrics.totalRelationships++;

    await this.invalidateCaches(request.userId, request.targetUserId);

    await this.emitRelationshipEvent('friend.requested', relationship);

    this.logger.info('Friend request sent', { relationship });

    return relationship;
  }

  async respondToFriendRequest(response: FriendRequestResponse): Promise<UserRelationship> {
    this.logger.debug('Friend request response', { response });

    const relationship = this.relationships.get(response.requestId);
    if (!relationship) {
      throw new Error('Friend request not found');
    }

    if (relationship.type !== RelationshipType.FRIEND_REQUEST) {
      throw new Error('Not a friend request');
    }

    if (relationship.targetUserId !== response.userId) {
      throw new Error('Unauthorized to respond to this request');
    }

    if (relationship.status !== RelationshipStatus.PENDING) {
      throw new Error('Request already processed');
    }

    relationship.status = response.accepted
      ? RelationshipStatus.ACTIVE
      : RelationshipStatus.REJECTED;
    relationship.updatedAt = new Date();

    if (response.accepted) {
      // Create bidirectional follows
      await this.follow({
        userId: relationship.sourceUserId,
        targetUserId: relationship.targetUserId
      });
      await this.follow({
        userId: relationship.targetUserId,
        targetUserId: relationship.sourceUserId
      });
    }

    this.metrics.pendingRequests--;

    await this.invalidateCaches(relationship.sourceUserId, relationship.targetUserId);

    await this.emitRelationshipEvent(
      response.accepted ? 'friend.accepted' : 'friend.rejected',
      relationship
    );

    this.logger.info('Friend request responded', { relationship });

    return relationship;
  }

  async cancelFriendRequest(requestId: string, userId: string): Promise<boolean> {
    const relationship = this.relationships.get(requestId);

    if (!relationship || relationship.sourceUserId !== userId) {
      return false;
    }

    if (relationship.type !== RelationshipType.FRIEND_REQUEST) {
      return false;
    }

    relationship.status = RelationshipStatus.CANCELLED;
    relationship.updatedAt = new Date();

    this.metrics.pendingRequests--;

    await this.invalidateCaches(relationship.sourceUserId, relationship.targetUserId);

    await this.emitRelationshipEvent('friend.cancelled', relationship);

    return true;
  }

  async getPendingFriendRequests(
    userId: string,
    pagination?: PaginationOptions
  ): Promise<UserRelationship[]> {
    const requests = Array.from(this.relationships.values()).filter(
      r => r.targetUserId === userId &&
           r.type === RelationshipType.FRIEND_REQUEST &&
           r.status === RelationshipStatus.PENDING
    );

    return this.paginateResults(requests, pagination);
  }

  // ============================================================================
  // List Operations
  // ============================================================================

  async getFollowers(
    userId: string,
    pagination?: PaginationOptions
  ): Promise<FollowerListResponse> {
    // Check cache
    const cacheKey = `relationship:followers:${userId}:${pagination?.offset || 0}:${pagination?.limit || 50}`;
    if (this.cache) {
      const cached = await this.cache.get<FollowerListResponse>(cacheKey);
      if (cached) return cached;
    }

    const followerIds = this.graph.getFollowers(userId);
    const limit = pagination?.limit || 50;
    const offset = pagination?.offset || 0;

    const paginatedIds = followerIds.slice(offset, offset + limit);
    const followers: UserRelationshipInfo[] = paginatedIds.map(followerId => ({
      userId: followerId,
      relationship: this.findRelationship(followerId, userId, RelationshipType.FOLLOW)!,
      isMutual: this.graph.isFollowing(userId, followerId)
    }));

    const response: FollowerListResponse = {
      followers,
      total: followerIds.length,
      hasMore: offset + limit < followerIds.length,
      nextCursor: offset + limit < followerIds.length ? String(offset + limit) : undefined
    };

    // Cache response
    if (this.cache) {
      await this.cache.set(cacheKey, response, 300); // 5 minutes
    }

    return response;
  }

  async getFollowing(
    userId: string,
    pagination?: PaginationOptions
  ): Promise<FollowingListResponse> {
    const cacheKey = `relationship:following:${userId}:${pagination?.offset || 0}:${pagination?.limit || 50}`;
    if (this.cache) {
      const cached = await this.cache.get<FollowingListResponse>(cacheKey);
      if (cached) return cached;
    }

    const followingIds = this.graph.getFollowing(userId);
    const limit = pagination?.limit || 50;
    const offset = pagination?.offset || 0;

    const paginatedIds = followingIds.slice(offset, offset + limit);
    const following: UserRelationshipInfo[] = paginatedIds.map(targetId => ({
      userId: targetId,
      relationship: this.findRelationship(userId, targetId, RelationshipType.FOLLOW)!,
      isMutual: this.graph.isFollowing(targetId, userId)
    }));

    const response: FollowingListResponse = {
      following,
      total: followingIds.length,
      hasMore: offset + limit < followingIds.length,
      nextCursor: offset + limit < followingIds.length ? String(offset + limit) : undefined
    };

    if (this.cache) {
      await this.cache.set(cacheKey, response, 300);
    }

    return response;
  }

  async getMutualFollows(
    userId: string,
    pagination?: PaginationOptions
  ): Promise<UserRelationship[]> {
    const mutualIds = this.graph.getMutualFollows(userId);
    const relationships = mutualIds
      .map(targetId => this.findRelationship(userId, targetId, RelationshipType.FOLLOW))
      .filter(r => r !== null) as UserRelationship[];

    return this.paginateResults(relationships, pagination);
  }

  async getBlockedUsers(
    userId: string,
    pagination?: PaginationOptions
  ): Promise<UserRelationship[]> {
    const relationships = Array.from(this.relationships.values()).filter(
      r => r.sourceUserId === userId &&
           r.type === RelationshipType.BLOCK &&
           r.status === RelationshipStatus.ACTIVE
    );

    return this.paginateResults(relationships, pagination);
  }

  async getMutedUsers(
    userId: string,
    pagination?: PaginationOptions
  ): Promise<UserRelationship[]> {
    const relationships = Array.from(this.relationships.values()).filter(
      r => r.sourceUserId === userId &&
           r.type === RelationshipType.MUTE &&
           r.status === RelationshipStatus.ACTIVE &&
           (!r.expiresAt || r.expiresAt > new Date())
    );

    return this.paginateResults(relationships, pagination);
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  async getRelationshipStats(userId: string): Promise<RelationshipStats> {
    // Check cache
    if (this.cache) {
      const cached = await this.cache.get<RelationshipStats>(
        `relationship:stats:${userId}`
      );
      if (cached) return cached;
    }

    const stats: RelationshipStats = {
      followerCount: this.graph.getFollowers(userId).length,
      followingCount: this.graph.getFollowing(userId).length,
      mutualFollowCount: this.graph.getMutualFollows(userId).length,
      blockedCount: Array.from(this.relationships.values()).filter(
        r => r.sourceUserId === userId && r.type === RelationshipType.BLOCK && r.status === RelationshipStatus.ACTIVE
      ).length,
      mutedCount: Array.from(this.relationships.values()).filter(
        r => r.sourceUserId === userId && r.type === RelationshipType.MUTE && r.status === RelationshipStatus.ACTIVE
      ).length,
      pendingRequestCount: Array.from(this.relationships.values()).filter(
        r => r.targetUserId === userId && r.status === RelationshipStatus.PENDING
      ).length
    };

    // Cache stats
    if (this.cache) {
      await this.cache.set(`relationship:stats:${userId}`, stats, 300);
    }

    return stats;
  }

  async checkMutualRelationship(
    userId: string,
    targetUserId: string
  ): Promise<MutualRelationshipResult> {
    const sourceRelationship = this.findRelationship(userId, targetUserId, RelationshipType.FOLLOW);
    const targetRelationship = this.findRelationship(targetUserId, userId, RelationshipType.FOLLOW);

    const isMutual = !!(
      sourceRelationship?.status === RelationshipStatus.ACTIVE &&
      targetRelationship?.status === RelationshipStatus.ACTIVE
    );

    return {
      userId,
      targetUserId,
      isMutual,
      sourceRelationship: sourceRelationship || undefined,
      targetRelationship: targetRelationship || undefined
    };
  }

  // ============================================================================
  // Recommendations
  // ============================================================================

  async getRecommendations(
    userId: string,
    limit: number = 10
  ): Promise<RelationshipRecommendation[]> {
    // Check cache
    if (this.cache) {
      const cached = await this.cache.get<RelationshipRecommendation[]>(
        `relationship:recommendations:${userId}`
      );
      if (cached) return cached.slice(0, limit);
    }

    const recommendations: RelationshipRecommendation[] = [];
    const following = new Set(this.graph.getFollowing(userId));
    const blocked = new Set(this.graph.getNode(userId).blocked);

    // Find users followed by people the user follows (friends of friends)
    const potentialUsers = new Set<string>();

    for (const followedUserId of following) {
      const secondDegree = this.graph.getFollowing(followedUserId);
      secondDegree.forEach(uid => {
        if (uid !== userId && !following.has(uid) && !blocked.has(uid)) {
          potentialUsers.add(uid);
        }
      });
    }

    // Calculate scores
    for (const targetUserId of potentialUsers) {
      const mutualFollowers = Array.from(following).filter(followedId =>
        this.graph.isFollowing(followedId, targetUserId)
      ).length;

      const score = mutualFollowers * 10; // Simple scoring

      recommendations.push({
        userId: targetUserId,
        score,
        reason: `${mutualFollowers} mutual connection${mutualFollowers !== 1 ? 's' : ''}`,
        mutualFollowers
      });
    }

    // Sort by score
    recommendations.sort((a, b) => b.score - a.score);

    const result = recommendations.slice(0, limit);

    // Cache recommendations
    if (this.cache) {
      await this.cache.set(
        `relationship:recommendations:${userId}`,
        result,
        1800 // 30 minutes
      );
    }

    return result;
  }

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  async bulkFollow(request: BulkFollowRequest): Promise<BulkOperationResult> {
    this.logger.info('Bulk follow request', { count: request.targetUserIds.length });

    const successful: string[] = [];
    const failed: Array<{ userId: string; error: string }> = [];

    const batchSize = request.batchSize || 10;
    const delayMs = request.delayMs || 100;

    for (let i = 0; i < request.targetUserIds.length; i += batchSize) {
      const batch = request.targetUserIds.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map(targetUserId =>
          this.follow({ userId: request.userId, targetUserId })
        )
      );

      results.forEach((result, index) => {
        const targetUserId = batch[index];
        if (result.status === 'fulfilled') {
          successful.push(targetUserId);
        } else {
          failed.push({
            userId: targetUserId,
            error: result.reason?.message || 'Unknown error'
          });
        }
      });

      // Delay between batches
      if (i + batchSize < request.targetUserIds.length) {
        await this.delay(delayMs);
      }
    }

    return {
      successful,
      failed,
      total: request.targetUserIds.length,
      successCount: successful.length,
      failureCount: failed.length
    };
  }

  async bulkUnfollow(request: BulkUnfollowRequest): Promise<BulkOperationResult> {
    this.logger.info('Bulk unfollow request', { count: request.targetUserIds.length });

    const successful: string[] = [];
    const failed: Array<{ userId: string; error: string }> = [];

    const batchSize = request.batchSize || 10;
    const delayMs = request.delayMs || 100;

    for (let i = 0; i < request.targetUserIds.length; i += batchSize) {
      const batch = request.targetUserIds.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map(targetUserId =>
          this.unfollow({ userId: request.userId, targetUserId })
        )
      );

      results.forEach((result, index) => {
        const targetUserId = batch[index];
        if (result.status === 'fulfilled' && result.value) {
          successful.push(targetUserId);
        } else {
          failed.push({
            userId: targetUserId,
            error: result.status === 'rejected' ? result.reason?.message : 'Not following'
          });
        }
      });

      if (i + batchSize < request.targetUserIds.length) {
        await this.delay(delayMs);
      }
    }

    return {
      successful,
      failed,
      total: request.targetUserIds.length,
      successCount: successful.length,
      failureCount: failed.length
    };
  }

  // ============================================================================
  // Privacy Settings
  // ============================================================================

  async getPrivacySettings(userId: string): Promise<RelationshipPrivacySettings> {
    if (this.cache) {
      const cached = await this.cache.get<RelationshipPrivacySettings>(
        `relationship:privacy:${userId}`
      );
      if (cached) return cached;
    }

    let settings = this.privacySettings.get(userId);

    if (!settings) {
      settings = {
        userId,
        hideFollowers: false,
        hideFollowing: false,
        requireApprovalForFollows: false,
        allowFriendRequests: true,
        allowMessages: true
      };
      this.privacySettings.set(userId, settings);
    }

    if (this.cache) {
      await this.cache.set(`relationship:privacy:${userId}`, settings, 3600);
    }

    return settings;
  }

  async updatePrivacySettings(
    userId: string,
    settings: Partial<RelationshipPrivacySettings>
  ): Promise<RelationshipPrivacySettings> {
    const current = await this.getPrivacySettings(userId);
    const updated = { ...current, ...settings, userId };

    this.privacySettings.set(userId, updated);

    if (this.cache) {
      await this.cache.set(`relationship:privacy:${userId}`, updated, 3600);
    }

    await this.eventBus.publish(
      new DomainEventBuilder()
        .withType(EventType.USER_UPDATED)
        .withAggregateId(userId)
        .withAggregateType('User')
        .withPayload({ privacySettings: updated })
        .withUserId(userId)
        .withSource('UserRelationshipService')
        .build()
    );

    this.logger.info('Privacy settings updated', { userId });

    return updated;
  }

  // ============================================================================
  // Validation
  // ============================================================================

  async validateRelationship(
    userId: string,
    targetUserId: string
  ): Promise<RelationshipValidationResult> {
    const [
      isBlocked,
      isBlockedBy,
      isMuted,
      isMutedBy,
      isFollowing,
      isFollowedBy,
      targetPrivacy
    ] = await Promise.all([
      this.isBlocking(userId, targetUserId),
      this.isBlockedBy(userId, targetUserId),
      this.isMuting(userId, targetUserId),
      this.isMuting(targetUserId, userId),
      this.isFollowing(userId, targetUserId),
      this.isFollowing(targetUserId, userId),
      this.getPrivacySettings(targetUserId)
    ]);

    return {
      valid: !isBlocked && !isBlockedBy,
      canFollow: !isBlocked && !isBlockedBy,
      canMessage: !isBlocked && !isBlockedBy && targetPrivacy.allowMessages,
      canViewProfile: !isBlocked && !isBlockedBy,
      isBlocked,
      isBlockedBy,
      isMuted,
      isMutedBy,
      isFollowing,
      isFollowedBy,
      requiresApproval: targetPrivacy.requireApprovalForFollows
    };
  }

  // ============================================================================
  // Import/Export
  // ============================================================================

  async importFollows(request: ImportFollowsRequest): Promise<BulkOperationResult> {
    this.logger.info('Import follows request', {
      source: request.source,
      count: request.userIds.length
    });

    return this.bulkFollow({
      userId: request.userId,
      targetUserIds: request.userIds,
      batchSize: 20,
      delayMs: 50
    });
  }

  async exportRelationships(userId: string): Promise<ExportFollowsResponse> {
    const followers = this.graph.getFollowers(userId);
    const following = this.graph.getFollowing(userId);

    const blocked = Array.from(this.relationships.values())
      .filter(r => r.sourceUserId === userId && r.type === RelationshipType.BLOCK)
      .map(r => r.targetUserId);

    const muted = Array.from(this.relationships.values())
      .filter(r => r.sourceUserId === userId && r.type === RelationshipType.MUTE)
      .map(r => r.targetUserId);

    return {
      userId,
      followers,
      following,
      blocked,
      muted,
      exportedAt: new Date()
    };
  }

  // ============================================================================
  // Query
  // ============================================================================

  async queryRelationships(options: RelationshipQueryOptions): Promise<UserRelationship[]> {
    let results = Array.from(this.relationships.values()).filter(
      r => r.sourceUserId === options.userId || r.targetUserId === options.userId
    );

    // Apply filters
    if (options.type) {
      results = results.filter(r => r.type === options.type);
    }

    if (options.status) {
      results = results.filter(r => r.status === options.status);
    }

    if (!options.includeExpired) {
      results = results.filter(r => !r.expiresAt || r.expiresAt > new Date());
    }

    // Sort
    if (options.sortBy) {
      results.sort((a, b) => {
        const aVal = a[options.sortBy!];
        const bVal = b[options.sortBy!];
        const order = options.sortOrder === 'desc' ? -1 : 1;
        return aVal < bVal ? -order : aVal > bVal ? order : 0;
      });
    }

    return this.paginateResults(results, options.pagination);
  }

  // ============================================================================
  // Metrics
  // ============================================================================

  async getMetrics(): Promise<RelationshipMetrics> {
    const totalUsers = this.graph['nodes'].size;
    const mutualFollows = Array.from(this.graph['nodes'].values())
      .reduce((sum, node) => sum + this.graph.getMutualFollows(node.userId).length, 0) / 2;

    return {
      ...this.metrics,
      mutualFollows,
      avgFollowersPerUser: totalUsers > 0 ? this.metrics.activeFollows / totalUsers : 0,
      avgFollowingPerUser: totalUsers > 0 ? this.metrics.activeFollows / totalUsers : 0
    };
  }

  // ============================================================================
  // Health & Maintenance
  // ============================================================================

  async cleanupExpiredRelationships(): Promise<number> {
    const now = new Date();
    let cleanedCount = 0;

    for (const [id, relationship] of this.relationships.entries()) {
      if (relationship.expiresAt && relationship.expiresAt <= now) {
        this.relationships.delete(id);

        if (relationship.type === RelationshipType.MUTE) {
          this.graph.removeMute(relationship.sourceUserId, relationship.targetUserId);
          this.metrics.activeMutes--;
        }

        this.metrics.totalRelationships--;
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.info('Cleaned up expired relationships', { count: cleanedCount });
    }

    return cleanedCount;
  }

  async rebuildCache(): Promise<boolean> {
    if (!this.cache) return true;

    try {
      await this.cache.invalidate('relationship:*');
      this.logger.info('Relationship cache rebuilt');
      return true;
    } catch (error) {
      this.logger.error('Failed to rebuild cache', error);
      return false;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Check internal state
      const hasRelationships = this.relationships.size >= 0;
      const graphInitialized = this.graph !== null;

      // Check cache if available
      if (this.cache) {
        const cacheHealthy = await this.cache.healthCheck();
        if (!cacheHealthy) return false;
      }

      return hasRelationships && graphInitialized;
    } catch (error) {
      this.logger.error('Health check failed', error);
      return false;
    }
  }

  async dispose(): Promise<void> {
    this.relationships.clear();
    this.graph.clear();
    this.privacySettings.clear();
    this.operationCounts.clear();
    this.logger.info('UserRelationshipService disposed');
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private validateUserIds(userId: string, targetUserId: string): void {
    if (!userId || !targetUserId) {
      throw new Error('User IDs are required');
    }

    if (userId === targetUserId) {
      throw new Error('Cannot create relationship with self');
    }
  }

  private generateId(): string {
    return `rel_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`;
  }

  private findRelationship(
    sourceUserId: string,
    targetUserId: string,
    type: RelationshipType
  ): UserRelationship | null {
    for (const relationship of this.relationships.values()) {
      if (
        relationship.sourceUserId === sourceUserId &&
        relationship.targetUserId === targetUserId &&
        relationship.type === type
      ) {
        return relationship;
      }
    }
    return null;
  }

  private paginateResults<T>(
    results: T[],
    pagination?: PaginationOptions
  ): T[] {
    if (!pagination) return results;

    const limit = pagination.limit || 50;
    const offset = pagination.offset || 0;

    return results.slice(offset, offset + limit);
  }

  private async invalidateCaches(userId: string, targetUserId: string): Promise<void> {
    if (!this.cache) return;

    await Promise.all([
      this.cache.invalidate(`relationship:following:${userId}:*`),
      this.cache.invalidate(`relationship:followers:${targetUserId}:*`),
      this.cache.invalidate(`relationship:stats:${userId}`),
      this.cache.invalidate(`relationship:stats:${targetUserId}`),
      this.cache.invalidate(`relationship:recommendations:${userId}`),
      this.cache.invalidate(`relationship:recommendations:${targetUserId}`)
    ]);
  }

  private async emitRelationshipEvent(
    eventType: string,
    relationship: UserRelationship
  ): Promise<void> {
    try {
      await this.eventBus.publish(
        new DomainEventBuilder()
          .withType(eventType as any)
          .withAggregateId(relationship.id)
          .withAggregateType('UserRelationship')
          .withPayload({
            sourceUserId: relationship.sourceUserId,
            targetUserId: relationship.targetUserId,
            type: relationship.type,
            status: relationship.status
          })
          .withUserId(relationship.sourceUserId)
          .withSource('UserRelationshipService')
          .build()
      );
    } catch (error) {
      this.logger.error('Failed to emit relationship event', error);
    }
  }

  private async checkRateLimit(userId: string, operation: string): Promise<void> {
    const key = `${userId}:${operation}`;
    const now = new Date();

    let tracker = this.operationCounts.get(key);

    if (!tracker || tracker.resetAt < now) {
      tracker = {
        count: 0,
        resetAt: new Date(now.getTime() + 3600000) // 1 hour from now
      };
      this.operationCounts.set(key, tracker);
    }

    if (tracker.count >= this.MAX_OPERATIONS_PER_HOUR) {
      throw new Error(`Rate limit exceeded for ${operation}. Try again later.`);
    }

    tracker.count++;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
