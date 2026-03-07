/**
 * Follow Service
 * Slice 8: Creator Network + Notifications
 *
 * Manages follow relationships between creators.
 * Fire-and-forget event emission — notification failures must NOT block follow operations.
 *
 * Patterns applied:
 *   - TTLCache for pubkey→UUID resolution (common-solutions.md #2)
 *   - Table name: `followers` (matches baseline_schema.sql:126 and follow_count_trigger)
 */

import type {
  IFollowService,
  PaginationParams,
  PaginatedResult,
} from '../../interfaces/community/IFollowService';
import type { ILogger } from '../../interfaces/shared/ILogger';
import type { ISupabaseClient } from '../../interfaces/shared/ISupabaseClient';
import type { IEventBus } from '../../interfaces/shared/IEventBus';
import type { FollowRelationship, FollowCounts } from '@shared/types/community';
import { ConflictError, UnauthorizedError, ValidationError } from '../../utils/errors';
import { DomainEventType } from '../../interfaces/shared/IEventBus';
import { TTLCache } from '../../utils/ttl-cache';
import crypto from 'crypto';

interface FollowRow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

export class FollowService implements IFollowService {
  private readonly db: ISupabaseClient;
  private readonly logger: ILogger;
  private readonly eventBus: IEventBus;

  // TTLCache pattern (common-solutions.md #2) — auto-evicts stale entries, bounded size
  private readonly userIdCache = new TTLCache<string, string>({
    ttlMs: 60_000,
    maxSize: 1000,
  });

  constructor(db: ISupabaseClient, logger: ILogger, eventBus: IEventBus) {
    this.db = db;
    this.logger = logger;
    this.eventBus = eventBus;
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /** Resolve a NOSTR pubkey to the internal UUID. Cached for 60s. */
  private async getUserIdByPubkey(pubkey: string): Promise<string> {
    const cached = this.userIdCache.get(pubkey);
    if (cached) return cached;

    const { data, error } = await this.db
      .from('users')
      .select('id')
      .eq('nostr_pubkey', pubkey)
      .single();

    if (error || !data) {
      throw new UnauthorizedError('User profile not found');
    }

    const userId = (data as { id: string }).id;
    this.userIdCache.set(pubkey, userId);
    return userId;
  }

  // ============================================================================
  // Public Methods — pubkey parameters are resolved to UUIDs before DB ops
  // ============================================================================

  async follow(followerPubkey: string, followingId: string): Promise<{ id: string }> {
    const followerId = await this.getUserIdByPubkey(followerPubkey);

    if (followerId === followingId) {
      throw new ValidationError('Cannot follow yourself');
    }

    const { data, error } = await this.db
      .from<FollowRow>('followers')
      .insert({ follower_id: followerId, following_id: followingId })
      .select('id')
      .single();

    if (error) {
      // Unique constraint violation — already following
      if (error.code === '23505') {
        throw new ConflictError('Already following this user');
      }
      this.logger.error('FollowService.follow: DB error', { error, followerId, followingId });
      throw new ValidationError(`Failed to follow: ${error.message}`);
    }

    if (!data) {
      throw new ValidationError('Failed to create follow relationship');
    }

    this.logger.info('FollowService.follow: followed', { followerId, followingId });

    // Fire-and-forget — notification failure must NOT block follow operation
    void this.eventBus
      .publish({
        id: `evt_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`,
        type: DomainEventType.COMMUNITY_USER_FOLLOWED,
        aggregateId: data.id,
        aggregateType: 'follow',
        payload: { followerId, followingId },
        metadata: {
          timestamp: new Date(),
          version: '1.0.0',
          source: 'FollowService',
          userId: followerId,
        },
      })
      .catch((err) => {
        this.logger.error('FollowService.follow: event emission failed (non-blocking)', {
          err,
          followerId,
          followingId,
        });
      });

    return { id: data.id };
  }

  async unfollow(followerPubkey: string, followingId: string): Promise<void> {
    const followerId = await this.getUserIdByPubkey(followerPubkey);

    const { error } = await this.db
      .from<FollowRow>('followers')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', followingId);

    if (error) {
      this.logger.error('FollowService.unfollow: DB error', { error, followerId, followingId });
      throw new ValidationError(`Failed to unfollow: ${error.message}`);
    }

    this.logger.info('FollowService.unfollow: unfollowed', { followerId, followingId });
  }

  async isFollowing(followerPubkey: string, followingId: string): Promise<boolean> {
    const followerId = await this.getUserIdByPubkey(followerPubkey);

    const { data, error } = await this.db
      .from<FollowRow>('followers')
      .select('id')
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
      .maybeSingle();

    if (error) {
      this.logger.error('FollowService.isFollowing: DB error', { error, followerId, followingId });
      throw new ValidationError(`Failed to check follow status: ${error.message}`);
    }

    return data !== null;
  }

  async getFollowers(
    userIdOrPubkey: string,
    opts: PaginationParams
  ): Promise<PaginatedResult<FollowRelationship>> {
    const userId = await this.getUserIdByPubkey(userIdOrPubkey).catch(() => userIdOrPubkey);
    const { page, limit } = opts;
    const offset = (page - 1) * limit;

    const { data, error, count } = await this.db
      .from<FollowRow>('followers')
      .select('id, follower_id, following_id, created_at', { count: 'exact' })
      .eq('following_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      this.logger.error('FollowService.getFollowers: DB error', { error, userId });
      throw new ValidationError(`Failed to get followers: ${error.message}`);
    }

    const items = (data ?? []).map((row) => ({
      id: row.id,
      followerId: row.follower_id,
      followingId: row.following_id,
      createdAt: row.created_at,
    }));

    const total = count ?? 0;
    return { items, total, page, limit, hasNext: offset + items.length < total };
  }

  async getFollowing(
    userIdOrPubkey: string,
    opts: PaginationParams
  ): Promise<PaginatedResult<FollowRelationship>> {
    const userId = await this.getUserIdByPubkey(userIdOrPubkey).catch(() => userIdOrPubkey);
    const { page, limit } = opts;
    const offset = (page - 1) * limit;

    const { data, error, count } = await this.db
      .from<FollowRow>('followers')
      .select('id, follower_id, following_id, created_at', { count: 'exact' })
      .eq('follower_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      this.logger.error('FollowService.getFollowing: DB error', { error, userId });
      throw new ValidationError(`Failed to get following: ${error.message}`);
    }

    const items = (data ?? []).map((row) => ({
      id: row.id,
      followerId: row.follower_id,
      followingId: row.following_id,
      createdAt: row.created_at,
    }));

    const total = count ?? 0;
    return { items, total, page, limit, hasNext: offset + items.length < total };
  }

  async getFollowCounts(pubkey: string): Promise<FollowCounts> {
    const userId = await this.getUserIdByPubkey(pubkey);

    const [followersResult, followingResult] = await Promise.all([
      this.db
        .from<FollowRow>('followers')
        .select('id', { count: 'exact', head: true })
        .eq('following_id', userId),
      this.db
        .from<FollowRow>('followers')
        .select('id', { count: 'exact', head: true })
        .eq('follower_id', userId),
    ]);

    if (followersResult.error) {
      this.logger.error('FollowService.getFollowCounts: followers count error', {
        error: followersResult.error,
        userId,
      });
      throw new ValidationError(`Failed to get follow counts: ${followersResult.error.message}`);
    }

    if (followingResult.error) {
      this.logger.error('FollowService.getFollowCounts: following count error', {
        error: followingResult.error,
        userId,
      });
      throw new ValidationError(`Failed to get follow counts: ${followingResult.error.message}`);
    }

    return {
      followers: followersResult.count ?? 0,
      following: followingResult.count ?? 0,
    };
  }
}
