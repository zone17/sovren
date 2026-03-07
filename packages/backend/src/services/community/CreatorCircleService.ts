/**
 * Creator Circle Service
 * EPIC-010: Creator Network — Circle management, membership, and posts
 */

import type { ICreatorCircleService } from '../../interfaces/community/ICreatorCircleService';
import type { ILogger } from '../../interfaces/shared/ILogger';
import type { ISupabaseClient } from '../../interfaces/shared/ISupabaseClient';
import type { IEventBus } from '../../interfaces/shared/IEventBus';
import {
  AuthorizationError,
  ConflictError,
  DatabaseError,
  NotFoundError,
  ValidationError,
} from '../../utils/errors';
import { DomainEventType } from '../../interfaces/shared/IEventBus';
import { stripControlChars } from '../../utils/stripControlChars';
import { emitDomainEvent } from '../../utils/emitDomainEvent';

interface CircleRow {
  id: string;
  name: string;
  description: string | null;
  niche: string | null;
  max_members: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface CircleMemberRow {
  id: string;
  circle_id: string;
  creator_id: string;
  role: string;
  joined_at: string;
}

interface CirclePostRow {
  id: string;
  circle_id: string;
  author_id: string;
  content: string;
  created_at: string;
}

export class CreatorCircleService implements ICreatorCircleService {
  private readonly db: ISupabaseClient;
  private readonly logger: ILogger;
  private readonly eventBus: IEventBus;

  constructor(db: ISupabaseClient, logger: ILogger, eventBus: IEventBus) {
    this.db = db;
    this.logger = logger;
    this.eventBus = eventBus;
  }

  private emitEvent(
    type: DomainEventType,
    aggregateId: string,
    payload: Record<string, unknown>
  ): void {
    emitDomainEvent(
      this.eventBus,
      this.logger,
      type,
      aggregateId,
      'circle',
      payload,
      'CreatorCircleService'
    );
  }

  async createCircle(
    creatorId: string,
    data: { name: string; description?: string; niche?: string; maxMembers?: number }
  ): Promise<{ id: string }> {
    const maxMembers = data.maxMembers ?? 20;

    if (maxMembers < 5 || maxMembers > 20) {
      throw new ValidationError('Circle size must be between 5 and 20 members');
    }

    // #264: Atomic creation via RPC — circle + admin member in one transaction
    const { data: circleId, error } = await this.db.rpc<string>('create_circle_atomic', {
      p_name: data.name,
      p_description: data.description ?? null,
      p_niche: data.niche ?? null,
      p_max_members: maxMembers,
      p_created_by: creatorId,
    });

    if (error || !circleId) {
      this.logger.error('Failed to create circle', { error, creatorId });
      throw new DatabaseError('Failed to create circle');
    }

    this.logger.info('Circle created', { circleId, creatorId });
    return { id: circleId };
  }

  async getCircles(creatorId: string): Promise<CircleRow[]> {
    // Step 1: Get circle IDs where creatorId is a member
    const { data: memberships } = await this.db
      .from<CircleMemberRow>('circle_members')
      .select('circle_id')
      .eq('creator_id', creatorId);

    const memberCircleIds = (memberships ?? []).map((m) => m.circle_id);

    // Step 2: Single query — circles created by OR joined by this creator
    let query = this.db
      .from<CircleRow>('creator_circles')
      .select('id, name, description, niche, max_members, created_by, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (memberCircleIds.length > 0) {
      query = query.or(`created_by.eq.${creatorId},id.in.(${memberCircleIds.join(',')})`);
    } else {
      query = query.eq('created_by', creatorId);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error('Failed to get circles', { error, creatorId });
      throw new DatabaseError('Failed to get circles');
    }

    return data ?? [];
  }

  async getSuggestedCircles(creatorId: string): Promise<CircleRow[]> {
    // Parallel: fetch memberships + creator's niche in one round-trip
    const [membershipsResult, nicheResult] = await Promise.all([
      this.db
        .from<CircleMemberRow>('circle_members')
        .select('circle_id')
        .eq('creator_id', creatorId),
      this.db
        .from<CircleRow>('creator_circles')
        .select('niche')
        .eq('created_by', creatorId)
        .limit(1)
        .maybeSingle(),
    ]);

    const joinedIds = (membershipsResult.data ?? []).map((m) => m.circle_id);
    const niche = nicheResult.data?.niche;

    // Build suggestion query
    let query = this.db
      .from<CircleRow>('creator_circles')
      .select('id, name, description, niche, max_members, created_by, created_at, updated_at')
      .neq('created_by', creatorId)
      .order('created_at', { ascending: false });

    if (niche) {
      query = query.eq('niche', niche);
    }

    if (joinedIds.length > 0) {
      query = query.not('id', 'in', `(${joinedIds.join(',')})`);
    }

    const { data, error } = await query.limit(10);

    if (error) {
      this.logger.error('Failed to get suggested circles', { error, creatorId });
      throw new DatabaseError('Failed to get suggested circles');
    }

    return data ?? [];
  }

  async getCircleById(circleId: string): Promise<CircleRow> {
    const { data, error } = await this.db
      .from<CircleRow>('creator_circles')
      .select('id, name, description, niche, max_members, created_by, created_at, updated_at')
      .eq('id', circleId)
      .single();

    if (error || !data) {
      throw new NotFoundError('Circle');
    }

    return data;
  }

  async leaveCircle(creatorId: string, circleId: string): Promise<void> {
    // Verify circle exists
    const { data: circle, error: circleError } = await this.db
      .from<CircleRow>('creator_circles')
      .select('created_by')
      .eq('id', circleId)
      .single();

    if (circleError || !circle) {
      throw new NotFoundError('Circle');
    }

    // Admin cannot leave their own circle (they must delete it)
    if (circle.created_by === creatorId) {
      throw new AuthorizationError('Circle admin cannot leave their own circle');
    }

    // Verify membership exists before attempting delete (idempotent — no throw if already left)
    const { data: membership } = await this.db
      .from<CircleMemberRow>('circle_members')
      .select('id')
      .eq('circle_id', circleId)
      .eq('creator_id', creatorId)
      .maybeSingle();

    if (!membership) {
      this.logger.warn('leaveCircle: membership not found (already left or never joined)', {
        circleId,
        creatorId,
      });
      return;
    }

    const { error } = await this.db
      .from<CircleMemberRow>('circle_members')
      .delete()
      .eq('circle_id', circleId)
      .eq('creator_id', creatorId);

    if (error) {
      this.logger.error('Failed to leave circle', { error, circleId, creatorId });
      throw new DatabaseError('Failed to leave circle');
    }

    this.logger.info('Creator left circle', { circleId, creatorId });
  }

  async joinCircle(creatorId: string, circleId: string): Promise<void> {
    // Check circle exists
    const { data: circle, error: circleError } = await this.db
      .from<CircleRow>('creator_circles')
      .select('id, max_members, created_by')
      .eq('id', circleId)
      .single();

    if (circleError || !circle) {
      throw new NotFoundError('Circle');
    }

    // #361: Atomic insert-then-verify to prevent TOCTOU race on member count.
    // Step 1: INSERT the member (unique constraint prevents duplicates).
    // Step 2: Immediately count. If over capacity, DELETE and return 409.
    // This eliminates the race window between SELECT count and INSERT.
    const { error: insertError } = await this.db.from<CircleMemberRow>('circle_members').insert({
      circle_id: circleId,
      creator_id: creatorId,
      role: 'member',
    });

    if (insertError) {
      // Unique constraint violation means already a member
      if (insertError.code === '23505') {
        throw new ConflictError('Already a member of this circle');
      }
      this.logger.error('Failed to join circle', { error: insertError, circleId, creatorId });
      throw new DatabaseError('Failed to join circle');
    }

    // Step 2: Count members AFTER insert — if over capacity, rollback
    const { count: currentCount, error: countError } = await this.db
      .from<CircleMemberRow>('circle_members')
      .select('id', { count: 'exact', head: true })
      .eq('circle_id', circleId);

    if (countError) {
      // Cleanup the just-inserted row on count failure
      const { error: compensationError } = await this.db
        .from<CircleMemberRow>('circle_members')
        .delete()
        .eq('circle_id', circleId)
        .eq('creator_id', creatorId);
      if (compensationError) {
        this.logger.error('joinCircle: compensation DELETE failed', {
          compensationError,
          circleId,
          creatorId,
          originalError: countError,
        });
      }
      throw new DatabaseError('Failed to count circle members');
    }

    if ((currentCount ?? 0) > circle.max_members) {
      // Over capacity — remove the just-inserted member and return 409
      const { error: compensationError } = await this.db
        .from<CircleMemberRow>('circle_members')
        .delete()
        .eq('circle_id', circleId)
        .eq('creator_id', creatorId);
      if (compensationError) {
        this.logger.error('joinCircle: compensation DELETE failed (over capacity)', {
          compensationError,
          circleId,
          creatorId,
        });
      }
      throw new ConflictError(`Circle is full (max ${circle.max_members} members)`);
    }

    this.logger.info('Creator joined circle', { circleId, creatorId });

    this.emitEvent(DomainEventType.COMMUNITY_CIRCLE_JOINED, circleId, {
      circleAdminId: circle.created_by,
      joinerId: creatorId,
      circleId,
    });
  }

  async removeMember(circleId: string, memberId: string, requesterId: string): Promise<void> {
    // Only circle admin (creator) can remove members
    const { data: circle, error: circleError } = await this.db
      .from<CircleRow>('creator_circles')
      .select('created_by')
      .eq('id', circleId)
      .single();

    if (circleError || !circle) {
      throw new NotFoundError('Circle');
    }

    if (circle.created_by !== requesterId) {
      throw new AuthorizationError('Only the circle admin can remove members');
    }

    if (memberId === requesterId) {
      throw new AuthorizationError('Admin cannot remove themselves');
    }

    const { error } = await this.db
      .from<CircleMemberRow>('circle_members')
      .delete()
      .eq('circle_id', circleId)
      .eq('creator_id', memberId);

    if (error) {
      this.logger.error('Failed to remove member', { error, circleId, memberId });
      throw new DatabaseError('Failed to remove member');
    }

    this.logger.info('Member removed from circle', { circleId, memberId, requesterId });
  }

  async getCirclePosts(
    circleId: string,
    creatorId: string,
    pagination?: { offset?: number; limit?: number }
  ): Promise<CirclePostRow[]> {
    const offset = pagination?.offset ?? 0;
    const limit = Math.min(pagination?.limit ?? 50, 100); // #713: default 50, cap 100

    // #359: Verify requester is the circle creator OR a circle member before returning posts
    const { data: circle, error: circleError } = await this.db
      .from<CircleRow>('creator_circles')
      .select('id, created_by')
      .eq('id', circleId)
      .single();

    if (circleError || !circle) {
      throw new NotFoundError('Circle');
    }

    // Allow circle creator without membership row
    if (circle.created_by !== creatorId) {
      const { data: membership } = await this.db
        .from<CircleMemberRow>('circle_members')
        .select('id')
        .eq('circle_id', circleId)
        .eq('creator_id', creatorId)
        .maybeSingle();

      if (!membership) {
        throw new AuthorizationError('You must be a member of this circle to view posts');
      }
    }

    const { data, error } = await this.db
      .from<CirclePostRow>('circle_posts')
      .select('id, circle_id, author_id, content, created_at')
      .eq('circle_id', circleId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      this.logger.error('Failed to get circle posts', { error, circleId, creatorId });
      throw new DatabaseError('Failed to get circle posts');
    }

    return data ?? [];
  }

  async createPost(circleId: string, authorId: string, content: string): Promise<{ id: string }> {
    // #723: Verify the author is a member of the circle before allowing post creation.
    // Circle creator is implicitly authorized; other users must have a membership row.
    const { data: circle, error: circleError } = await this.db
      .from<CircleRow>('creator_circles')
      .select('created_by')
      .eq('id', circleId)
      .single();

    if (circleError || !circle) {
      throw new NotFoundError('Circle');
    }

    if (circle.created_by !== authorId) {
      const { data: membership } = await this.db
        .from<CircleMemberRow>('circle_members')
        .select('id')
        .eq('circle_id', circleId)
        .eq('creator_id', authorId)
        .maybeSingle();

      if (!membership) {
        throw new AuthorizationError('You must be a member of this circle to post');
      }
    }

    // Input validation (empty, length) handled by Zod at the route layer.
    // Strip control characters to prevent injection via non-printable chars.
    const sanitizedContent = stripControlChars(content.trim());

    const { data: rows, error } = await this.db
      .from<CirclePostRow>('circle_posts')
      .insert({
        circle_id: circleId,
        author_id: authorId,
        content: sanitizedContent,
      })
      .select('id')
      .single();

    if (error || !rows) {
      this.logger.error('Failed to create circle post', { error, circleId, authorId });
      throw new DatabaseError('Failed to create post');
    }

    this.logger.info('Circle post created', { postId: rows.id, circleId, authorId });

    // #731: Paginated fan-out — member SELECT uses PAGE_SIZE=500 to avoid unbounded queries.
    // Fire-and-forget: notification failures must NOT block post creation.
    void (async () => {
      try {
        const PAGE_SIZE = 500;
        const memberIds: string[] = [];
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
          const { data: members, error } = await this.db
            .from<CircleMemberRow>('circle_members')
            .select('creator_id')
            .eq('circle_id', circleId)
            .range(offset, offset + PAGE_SIZE - 1);

          if (error) {
            this.logger.error(
              'CreatorCircleService: failed to fetch members for event (non-blocking)',
              { error, circleId, postId: rows.id }
            );
            break;
          }

          const batch = members ?? [];
          for (const m of batch) memberIds.push(m.creator_id);
          hasMore = batch.length === PAGE_SIZE;
          offset += PAGE_SIZE;
        }

        this.emitEvent(DomainEventType.COMMUNITY_CIRCLE_POST_CREATED, rows.id, {
          authorId,
          circleId,
          postId: rows.id,
          memberIds,
        });
      } catch (err) {
        this.logger.error(
          'CreatorCircleService: failed to fetch members for event (non-blocking)',
          { err, circleId, postId: rows.id }
        );
      }
    })();

    return { id: rows.id };
  }
}
