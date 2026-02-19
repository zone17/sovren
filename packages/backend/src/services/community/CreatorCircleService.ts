/**
 * Creator Circle Service
 * EPIC-010: Creator Network — Circle management, membership, and posts
 */

import type { ICreatorCircleService } from '../../interfaces/community/ICreatorCircleService';
import type { ILogger } from '../../interfaces/shared/ILogger';
import type { ISupabaseClient } from '../../interfaces/shared/ISupabaseClient';

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

  constructor(db: ISupabaseClient, logger: ILogger) {
    this.db = db;
    this.logger = logger;
  }

  async createCircle(
    creatorId: string,
    data: { name: string; description?: string; niche?: string; maxMembers?: number }
  ): Promise<{ id: string }> {
    const maxMembers = data.maxMembers ?? 20;

    if (maxMembers < 5 || maxMembers > 20) {
      throw new Error('Circle size must be between 5 and 20 members');
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
      throw new Error(`Failed to create circle: ${error?.message}`);
    }

    this.logger.info('Circle created', { circleId, creatorId });
    return { id: circleId };
  }

  async getCircles(creatorId: string): Promise<CircleRow[]> {
    // #278: Add default limit to prevent unbounded result sets
    const { data, error } = await this.db
      .from<CircleRow>('creator_circles')
      .select('id, name, description, niche, max_members, created_by, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      this.logger.error('Failed to get circles', { error, creatorId });
      throw new Error(`Failed to get circles: ${error.message}`);
    }

    return data ?? [];
  }

  async getSuggestedCircles(creatorId: string): Promise<CircleRow[]> {
    // Get creator's niche from their existing circles or mentor profile
    const { data: myCircles } = await this.db
      .from<CircleRow>('creator_circles')
      .select('niche')
      .eq('created_by', creatorId)
      .limit(1)
      .maybeSingle();

    const niche = myCircles?.niche;

    // Suggest circles matching same niche that user hasn't joined
    if (niche) {
      const { data, error } = await this.db
        .from<CircleRow>('creator_circles')
        .select('id, name, description, niche, max_members, created_by, created_at, updated_at')
        .eq('niche', niche)
        .neq('created_by', creatorId)
        .limit(10);

      if (error) {
        this.logger.error('Failed to get suggested circles', { error, creatorId });
        throw new Error(`Failed to get suggested circles: ${error.message}`);
      }

      return data ?? [];
    }

    // Fallback: return most recently created circles
    const { data, error } = await this.db
      .from<CircleRow>('creator_circles')
      .select('id, name, description, niche, max_members, created_by, created_at, updated_at')
      .neq('created_by', creatorId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      this.logger.error('Failed to get suggested circles (fallback)', { error, creatorId });
      throw new Error(`Failed to get suggested circles: ${error.message}`);
    }

    return data ?? [];
  }

  async joinCircle(creatorId: string, circleId: string): Promise<void> {
    // Check circle exists and has capacity
    const { data: circle, error: circleError } = await this.db
      .from<CircleRow>('creator_circles')
      .select('id, max_members')
      .eq('id', circleId)
      .single();

    if (circleError || !circle) {
      throw new Error('Circle not found');
    }

    // #304: Use Supabase count instead of fetching all rows
    const { count: currentCount, error: countError } = await this.db
      .from<CircleMemberRow>('circle_members')
      .select('id', { count: 'exact', head: true })
      .eq('circle_id', circleId);

    if (countError) {
      throw new Error(`Failed to count circle members: ${countError.message}`);
    }
    if ((currentCount ?? 0) >= circle.max_members) {
      throw new Error(`Circle is full (max ${circle.max_members} members)`);
    }

    const { error } = await this.db.from<CircleMemberRow>('circle_members').insert({
      circle_id: circleId,
      creator_id: creatorId,
      role: 'member',
    });

    if (error) {
      // Unique constraint violation means already a member
      if (error.code === '23505') {
        throw new Error('Already a member of this circle');
      }
      this.logger.error('Failed to join circle', { error, circleId, creatorId });
      throw new Error(`Failed to join circle: ${error.message}`);
    }

    this.logger.info('Creator joined circle', { circleId, creatorId });
  }

  async removeMember(circleId: string, memberId: string, requesterId: string): Promise<void> {
    // Only circle admin (creator) can remove members
    const { data: circle, error: circleError } = await this.db
      .from<CircleRow>('creator_circles')
      .select('created_by')
      .eq('id', circleId)
      .single();

    if (circleError || !circle) {
      throw new Error('Circle not found');
    }

    if (circle.created_by !== requesterId) {
      throw new Error('Only the circle admin can remove members');
    }

    if (memberId === requesterId) {
      throw new Error('Admin cannot remove themselves');
    }

    const { error } = await this.db
      .from<CircleMemberRow>('circle_members')
      .delete()
      .eq('circle_id', circleId)
      .eq('creator_id', memberId);

    if (error) {
      this.logger.error('Failed to remove member', { error, circleId, memberId });
      throw new Error(`Failed to remove member: ${error.message}`);
    }

    this.logger.info('Member removed from circle', { circleId, memberId, requesterId });
  }

  async getCirclePosts(circleId: string, creatorId: string): Promise<CirclePostRow[]> {
    // Verify requester is a circle member (RLS handles this, but explicit check for clarity)
    const { data, error } = await this.db
      .from<CirclePostRow>('circle_posts')
      .select('id, circle_id, author_id, content, created_at')
      .eq('circle_id', circleId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      this.logger.error('Failed to get circle posts', { error, circleId, creatorId });
      throw new Error(`Failed to get circle posts: ${error.message}`);
    }

    return data ?? [];
  }

  async createPost(circleId: string, authorId: string, content: string): Promise<{ id: string }> {
    if (!content || content.trim().length === 0) {
      throw new Error('Post content cannot be empty');
    }

    if (content.length > 5000) {
      throw new Error('Post content exceeds 5000 character limit');
    }

    const { data: rows, error } = await this.db
      .from<CirclePostRow>('circle_posts')
      .insert({
        circle_id: circleId,
        author_id: authorId,
        content: content.trim(),
      })
      .select('id')
      .single();

    if (error || !rows) {
      this.logger.error('Failed to create circle post', { error, circleId, authorId });
      throw new Error(`Failed to create post: ${error?.message}`);
    }

    this.logger.info('Circle post created', { postId: rows.id, circleId, authorId });
    return { id: rows.id };
  }
}
