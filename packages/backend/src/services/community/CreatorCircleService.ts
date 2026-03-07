// @ts-nocheck
/**
 * Creator Circle Service
 * EPIC-010: Creator Network — Circle management, membership, and posts
 */

import type { ICreatorCircleService } from '../../interfaces/community/ICreatorCircleService';
import type { ILogger } from '../../interfaces/shared/ILogger';
import type { ISupabaseClient } from '../../interfaces/shared/ISupabaseClient';
import type { IEventBus } from '../../interfaces/shared/IEventBus';
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from '../../utils/errors';
import { DomainEventType } from '../../interfaces/shared/IEventBus';
import crypto from 'crypto';

/** Strip ASCII control characters (U+0000–U+001F) from user-supplied strings */
function stripControlChars(input: string): string {
  return input.replace(/[\x00-\x1F]/g, '');
}

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

  private emitEvent(type: DomainEventType, aggregateId: string, payload: Record<string, unknown>): void {
    // Fire-and-forget — notification failures must NOT block the main operation
    void this.eventBus
      .publish({
        id: `evt_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`,
        type,
        aggregateId,
        aggregateType: 'circle',
        payload,
        metadata: {
          timestamp: new Date(),
          version: '1.0.0',
          source: 'CreatorCircleService',
        },
      })
      .catch((err) => {
        this.logger.error('CreatorCircleService: event emission failed (non-blocking)', { err, type, aggregateId });
      });
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
      throw new ValidationError(`Failed to create circle: ${error?.message}`);
    }

    this.logger.info('Circle created', { circleId, creatorId });
    return { id: circleId };
  }

  async getCircles(creatorId: string): Promise<CircleRow[]> {
    // Get circle IDs where creatorId is a member
    const { data: memberships } = await this.db
      .from<CircleMemberRow>('circle_members')
      .select('circle_id')
      .eq('creator_id', creatorId);

    const memberCircleIds = (memberships ?? []).map((m) => m.circle_id);

    // Return circles the creator has created OR joined (deduped by DB IN clause + OR)
    // Two-part query approach: created circles union joined circles
    const createdQuery = this.db
      .from<CircleRow>('creator_circles')
      .select('id, name, description, niche, max_members, created_by, created_at, updated_at')
      .eq('created_by', creatorId)
      .order('created_at', { ascending: false })
      .limit(100);

    const { data: createdCircles, error: createdError } = await createdQuery;

    if (createdError) {
      this.logger.error('Failed to get created circles', { error: createdError, creatorId });
      throw new ValidationError(`Failed to get circles: ${createdError.message}`);
    }

    if (memberCircleIds.length === 0) {
      return createdCircles ?? [];
    }

    // Fetch joined circles (excluding ones they created, to avoid duplicates)
    const createdIds = (createdCircles ?? []).map((c) => c.id);
    const joinedOnlyIds = memberCircleIds.filter((id) => !createdIds.includes(id));

    if (joinedOnlyIds.length === 0) {
      return createdCircles ?? [];
    }

    const { data: joinedCircles, error: joinedError } = await this.db
      .from<CircleRow>('creator_circles')
      .select('id, name, description, niche, max_members, created_by, created_at, updated_at')
      .in('id', joinedOnlyIds)
      .order('created_at', { ascending: false });

    if (joinedError) {
      this.logger.error('Failed to get joined circles', { error: joinedError, creatorId });
      throw new ValidationError(`Failed to get circles: ${joinedError.message}`);
    }

    return [...(createdCircles ?? []), ...(joinedCircles ?? [])];
  }

  async getSuggestedCircles(creatorId: string): Promise<CircleRow[]> {
    // Fetch circle IDs that the creator has already joined (exclude from suggestions)
    const { data: memberships } = await this.db
      .from<CircleMemberRow>('circle_members')
      .select('circle_id')
      .eq('creator_id', creatorId);

    const joinedIds = (memberships ?? []).map((m) => m.circle_id);

    // Get creator's niche from their existing circles
    const { data: myCircles } = await this.db
      .from<CircleRow>('creator_circles')
      .select('niche')
      .eq('created_by', creatorId)
      .limit(1)
      .maybeSingle();

    const niche = myCircles?.niche;

    // Suggest circles matching same niche that user hasn't created or joined
    if (niche) {
      let query = this.db
        .from<CircleRow>('creator_circles')
        .select('id, name, description, niche, max_members, created_by, created_at, updated_at')
        .eq('niche', niche)
        .neq('created_by', creatorId);

      if (joinedIds.length > 0) {
        query = query.not('id', 'in', `(${joinedIds.join(',')})`);
      }

      const { data, error } = await query.limit(10);

      if (error) {
        this.logger.error('Failed to get suggested circles', { error, creatorId });
        throw new ValidationError(`Failed to get suggested circles: ${error.message}`);
      }

      return data ?? [];
    }

    // Fallback: return most recently created circles not already joined
    let query = this.db
      .from<CircleRow>('creator_circles')
      .select('id, name, description, niche, max_members, created_by, created_at, updated_at')
      .neq('created_by', creatorId)
      .order('created_at', { ascending: false });

    if (joinedIds.length > 0) {
      query = query.not('id', 'in', `(${joinedIds.join(',')})`);
    }

    const { data, error } = await query.limit(10);

    if (error) {
      this.logger.error('Failed to get suggested circles (fallback)', { error, creatorId });
      throw new ValidationError(`Failed to get suggested circles: ${error.message}`);
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
      throw new ValidationError(`Failed to leave circle: ${error.message}`);
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
      throw new ValidationError(`Failed to join circle: ${insertError.message}`);
    }

    // Step 2: Count members AFTER insert — if over capacity, rollback
    const { count: currentCount, error: countError } = await this.db
      .from<CircleMemberRow>('circle_members')
      .select('id', { count: 'exact', head: true })
      .eq('circle_id', circleId);

    if (countError) {
      // Cleanup the just-inserted row on count failure
      await this.db
        .from<CircleMemberRow>('circle_members')
        .delete()
        .eq('circle_id', circleId)
        .eq('creator_id', creatorId);
      throw new ValidationError(`Failed to count circle members: ${countError.message}`);
    }

    if ((currentCount ?? 0) > circle.max_members) {
      // Over capacity — remove the just-inserted member and return 409
      await this.db
        .from<CircleMemberRow>('circle_members')
        .delete()
        .eq('circle_id', circleId)
        .eq('creator_id', creatorId);
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
      throw new ValidationError(`Failed to remove member: ${error.message}`);
    }

    this.logger.info('Member removed from circle', { circleId, memberId, requesterId });
  }

  async getCirclePosts(circleId: string, creatorId: string): Promise<CirclePostRow[]> {
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
      .limit(50);

    if (error) {
      this.logger.error('Failed to get circle posts', { error, circleId, creatorId });
      throw new ValidationError(`Failed to get circle posts: ${error.message}`);
    }

    return data ?? [];
  }

  async createPost(circleId: string, authorId: string, content: string): Promise<{ id: string }> {
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
      throw new ValidationError(`Failed to create post: ${error?.message}`);
    }

    this.logger.info('Circle post created', { postId: rows.id, circleId, authorId });

    // Fetch member IDs for fan-out notification (fire-and-forget)
    void this.db
      .from<CircleMemberRow>('circle_members')
      .select('creator_id')
      .eq('circle_id', circleId)
      .then(({ data: members }) => {
        const memberIds = (members ?? []).map((m) => m.creator_id);
        this.emitEvent(DomainEventType.COMMUNITY_CIRCLE_POST_CREATED, rows.id, {
          authorId,
          circleId,
          postId: rows.id,
          memberIds,
        });
      })
      .catch((err) => {
        this.logger.error('CreatorCircleService: failed to fetch members for event (non-blocking)', {
          err,
          circleId,
          postId: rows.id,
        });
      });

    return { id: rows.id };
  }
}
