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
import { ConflictError, ValidationError } from '../../utils/errors';
import { DomainEventType } from '../../interfaces/shared/IEventBus';
import { getUserIdByPubkey } from '../../utils/getUserIdByPubkey';
import { emitDomainEvent } from '../../utils/emitDomainEvent';

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

  constructor(db: ISupabaseClient, logger: ILogger, eventBus: IEventBus) {
    this.db = db;
    this.logger = logger;
    this.eventBus = eventBus;
  }

  // ============================================================================
  // Public Methods — pubkey parameters are resolved to UUIDs before DB ops
  // ============================================================================

  async follow(followerPubkey: string, followingId: string): Promise<{ id: string }> {
    const followerId = await getUserIdByPubkey(this.db, followerPubkey);

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
    emitDomainEvent(
      this.eventBus,
      this.logger,
      DomainEventType.COMMUNITY_USER_FOLLOWED,
      data.id,
      'follow',
      { followerId, followingId },
      'FollowService'
    );

    return { id: data.id };
  }

  async unfollow(followerPubkey: string, followingId: string): Promise<void> {
    const followerId = await getUserIdByPubkey(this.db, followerPubkey);

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
    const followerId = await getUserIdByPubkey(this.db, followerPubkey);

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
    const userId = await getUserIdByPubkey(this.db, userIdOrPubkey).catch((err) => {
      this.logger.warn('getFollowers: getUserIdByPubkey fallback to raw ID', {
        err,
        userIdOrPubkey,
      });
      return userIdOrPubkey;
    });
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
      throw new ValidationError('Failed to get followers');
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
    const userId = await getUserIdByPubkey(this.db, userIdOrPubkey).catch((err) => {
      this.logger.warn('getFollowing: getUserIdByPubkey fallback to raw ID', {
        err,
        userIdOrPubkey,
      });
      return userIdOrPubkey;
    });
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
      throw new ValidationError('Failed to get following');
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

  async getFollowCounts(userIdOrPubkey: string): Promise<FollowCounts> {
    // Accept either a UUID or pubkey — allows route to pass :userId param directly
    const userId = await getUserIdByPubkey(this.db, userIdOrPubkey).catch((err) => {
      this.logger.warn('getFollowCounts: getUserIdByPubkey fallback to raw ID', {
        err,
        userIdOrPubkey,
      });
      return userIdOrPubkey;
    });

    // Prefer trigger-maintained columns on the creators table (single row read vs 2 COUNT scans)
    const { data: creator, error: creatorError } = await this.db
      .from('creators')
      .select('follower_count, following_count')
      .eq('user_id', userId)
      .maybeSingle();

    if (
      !creatorError &&
      creator &&
      creator.follower_count != null &&
      creator.following_count != null
    ) {
      return {
        followers: creator.follower_count as number,
        following: creator.following_count as number,
      };
    }

    // Fallback: COUNT queries if trigger columns are null or creator row missing
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
      throw new ValidationError('Failed to get follow counts');
    }

    if (followingResult.error) {
      this.logger.error('FollowService.getFollowCounts: following count error', {
        error: followingResult.error,
        userId,
      });
      throw new ValidationError('Failed to get follow counts');
    }

    return {
      followers: followersResult.count ?? 0,
      following: followingResult.count ?? 0,
    };
  }
}
