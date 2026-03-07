/**
 * CommentsService — Comments CRUD with Threading and Moderation
 * Slice 6: Squad B, Sprint 2
 *
 * Patterns applied:
 *   - TTLCache for pubkey→UUID resolution (common-solutions.md #2)
 *   - Service-layer authorization (critical-patterns.md #2)
 *   - Status guard on destructive ops (critical-patterns.md #7)
 *   - Atomic UPDATE with count check (critical-patterns.md #7)
 *   - AuthorizationError for ownership failures (403 not 400)
 */

import type { ISupabaseClient } from '../../interfaces/shared/ISupabaseClient';
import type { ILogger } from '../../interfaces/shared/ILogger';
import type { ICommentsService } from '../../interfaces/community/ICommentsService';
import type { IEventBus } from '../../interfaces/shared/IEventBus';
import type { CommentWithAuthor, CommentsPaginatedResponse } from '@shared/types/comments';
import { TTLCache } from '../../utils/ttl-cache';
import {
  UnauthorizedError,
  NotFoundError,
  ConflictError,
  ValidationError,
  AuthorizationError,
  ServiceError,
} from '../../utils/errors';
import { DomainEventType } from '../../interfaces/shared/IEventBus';
import crypto from 'crypto';

// Raw DB row shape returned by the comments + users JOIN
interface CommentRow {
  id: string;
  content_id: string;
  user_id: string;
  parent_comment_id: string | null;
  comment_text: string;
  status: string;
  reply_count: number;
  created_at: string;
  updated_at: string;
  users: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    username: string | null;
  };
}

// Shape returned by the deleteComment fetch (includes nested content)
interface CommentWithContent {
  id: string;
  user_id: string;
  content_id: string;
  status: string;
  content: { creator_id: string } | null;
}

export class CommentsService implements ICommentsService {
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

  /**
   * Strip dangerous control characters from user-supplied comment text.
   * Security: DOMPurify server-side without jsdom is a no-op — use char stripping instead.
   * React's default text node rendering handles HTML entity escaping client-side.
   */
  private sanitizeCommentText(raw: string): string {
    const trimmed = raw.trim().slice(0, 2000);
    // Strip control chars except \t (\x09), \n (\x0A), \r (\x0D) — intentional XSS sanitization
    // eslint-disable-next-line no-control-regex
    return trimmed.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }

  /** Map a raw DB row to the typed CommentWithAuthor shape. */
  private mapToCommentWithAuthor(row: CommentRow): CommentWithAuthor {
    return {
      id: row.id,
      contentId: row.content_id,
      userId: row.user_id,
      parentCommentId: row.parent_comment_id,
      commentText: row.comment_text,
      status: row.status as CommentWithAuthor['status'],
      replyCount: row.reply_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      author: {
        id: row.users.id,
        displayName: row.users.display_name ?? row.users.username ?? 'Anonymous',
        avatarUrl: row.users.avatar_url,
        username: row.users.username,
      },
    };
  }

  // ============================================================================
  // ICommentsService Implementation
  // ============================================================================

  async listComments(
    contentId: string,
    { page, limit }: { page: number; limit: number }
  ): Promise<CommentsPaginatedResponse> {
    // Content access check (D10) — return 404 for missing or non-published content
    // (prevents content UUID enumeration)
    const { data: content } = await this.db
      .from('content')
      .select('id, status')
      .eq('id', contentId)
      .single();

    if (!content || content.status !== 'published') {
      throw new NotFoundError('Content');
    }

    const offset = (page - 1) * limit;

    const { data, error, count } = await this.db
      .from('comments')
      .select('*, users!inner(id, display_name, avatar_url, username)', { count: 'exact' })
      .eq('content_id', contentId)
      .eq('status', 'active')
      .is('parent_comment_id', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      this.logger.error('[CommentsService] Failed to list comments', { error, contentId });
      throw new ServiceError('Failed to list comments');
    }

    const rows = (data ?? []) as unknown as CommentRow[];

    return {
      items: rows.map((row) => this.mapToCommentWithAuthor(row)),
      pagination: {
        page,
        limit,
        total: count ?? 0,
        hasNext: (count ?? 0) > offset + limit,
      },
    };
  }

  async listReplies(
    commentId: string,
    { page, limit }: { page: number; limit: number }
  ): Promise<CommentsPaginatedResponse> {
    // Verify parent comment exists and belongs to published content (security audit P2-1)
    const { data: parent } = await this.db
      .from('comments')
      .select('id, content_id, content!inner(status)')
      .eq('id', commentId)
      .single();

    if (!parent || (parent.content as { status: string }).status !== 'published') {
      throw new NotFoundError('Comment');
    }

    const offset = (page - 1) * limit;

    const { data, error, count } = await this.db
      .from('comments')
      .select('*, users!inner(id, display_name, avatar_url, username)', { count: 'exact' })
      .eq('parent_comment_id', commentId)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      this.logger.error('[CommentsService] Failed to list replies', { error, commentId });
      throw new ServiceError('Failed to list replies');
    }

    const rows = (data ?? []) as unknown as CommentRow[];

    return {
      items: rows.map((row) => this.mapToCommentWithAuthor(row)),
      pagination: {
        page,
        limit,
        total: count ?? 0,
        hasNext: (count ?? 0) > offset + limit,
      },
    };
  }

  async createComment(
    callerPubkey: string,
    contentId: string,
    payload: { parentCommentId?: string; commentText: string }
  ): Promise<CommentWithAuthor> {
    const userId = await this.getUserIdByPubkey(callerPubkey);

    // Content access check — prevent commenting on non-published content (security audit P3-2)
    const { data: content } = await this.db
      .from('content')
      .select('id, status')
      .eq('id', contentId)
      .single();

    if (!content || content.status !== 'published') {
      throw new NotFoundError('Content');
    }

    const sanitizedText = this.sanitizeCommentText(payload.commentText);

    // Two-level threading validation (primary service-layer guard; DB trigger is defense-in-depth)
    if (payload.parentCommentId) {
      const { data: parent } = await this.db
        .from('comments')
        .select('parent_comment_id, status, content_id')
        .eq('id', payload.parentCommentId)
        .eq('content_id', contentId) // Prevent cross-content parent references (review #626)
        .single();

      if (!parent) throw new NotFoundError('Parent comment');
      if (parent.status !== 'active') {
        throw new ConflictError('Parent comment is no longer available');
      }
      if (parent.parent_comment_id !== null) {
        throw new ValidationError('Cannot reply to a reply');
      }
    }

    const { data, error } = await this.db
      .from('comments')
      .insert({
        content_id: contentId,
        user_id: userId,
        parent_comment_id: payload.parentCommentId ?? null,
        comment_text: sanitizedText,
        status: 'active',
      })
      .select('*, users!inner(id, display_name, avatar_url, username)')
      .single();

    if (error) {
      this.logger.error('[CommentsService] Failed to create comment', { error, contentId });
      throw new ServiceError('Failed to create comment');
    }

    const comment = this.mapToCommentWithAuthor(data as unknown as CommentRow);

    // Fetch content creator to determine notification recipient
    // Fire-and-forget — notification failure must NOT block comment creation
    void this.db
      .from('content')
      .select('creator_id')
      .eq('id', contentId)
      .single()
      .then(({ data: contentRow }) => {
        if (!contentRow) return;
        const contentAuthorId = (contentRow as { creator_id: string }).creator_id;
        return this.eventBus.publish({
          id: `evt_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`,
          type: DomainEventType.COMMUNITY_COMMENT_CREATED,
          aggregateId: comment.id,
          aggregateType: 'comment',
          payload: {
            contentAuthorId,
            commentAuthorId: userId,
            contentId,
            commentId: comment.id,
          },
          metadata: {
            timestamp: new Date(),
            version: '1.0.0',
            source: 'CommentsService',
            userId,
          },
        });
      })
      .catch((err) => {
        this.logger.error('[CommentsService] event emission failed (non-blocking)', {
          err,
          commentId: comment.id,
          contentId,
        });
      });

    return comment;
  }

  async deleteComment(callerPubkey: string, commentId: string): Promise<void> {
    const userId = await this.getUserIdByPubkey(callerPubkey);

    // Fetch comment + content creator in one query (service-layer auth, critical-patterns.md #2)
    const { data: comment } = await this.db
      .from('comments')
      .select('id, user_id, content_id, status, content!inner(creator_id)')
      .eq('id', commentId)
      .single();

    if (!comment) throw new NotFoundError('Comment');

    // Status guard (critical-patterns.md #7)
    if (comment.status !== 'active') {
      throw new ConflictError('Comment is already deleted or moderated');
    }

    const commentData = comment as unknown as CommentWithContent;

    // Service-layer authorization check (critical-patterns.md #2)
    // AuthorizationError (403) — ownership failure is never a 400 ValidationError
    const isOwner = commentData.user_id === userId;
    const isContentCreator = commentData.content?.creator_id === userId;

    if (!isOwner && !isContentCreator) {
      throw new AuthorizationError('Not authorized to delete this comment');
    }

    const newStatus = isOwner ? 'deleted' : 'moderated';

    // Atomic status guard with count check (critical-patterns.md #7)
    // UPDATE WHERE status='active' — returns matched rows; empty = already modified
    const { data: updated, error: updateError } = await this.db
      .from('comments')
      .update({ status: newStatus })
      .eq('id', commentId)
      .eq('status', 'active')
      .select('id');

    if (updateError) {
      this.logger.error('[CommentsService] Failed to delete comment', { updateError, commentId });
      throw new ServiceError('Failed to delete comment');
    }

    if (!updated || updated.length === 0) {
      throw new ConflictError('Comment was already modified');
    }
  }
}
