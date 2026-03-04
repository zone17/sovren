/**
 * CommentsService Unit Tests — T14
 * Slice 6: Comments CRUD with Threading and Moderation
 *
 * Coverage target: 95%
 *
 * Test strategy:
 * - Table-aware Supabase mock routing (common-solutions.md #7)
 * - Tests every method: listComments, listReplies, createComment, deleteComment
 * - Tests every error path: UnauthorizedError, NotFoundError, ConflictError,
 *   ValidationError, AuthorizationError, ServiceError
 * - Tests XSS sanitization with control chars, NUL, and dangerous inputs
 * - Tests two-level threading enforcement
 * - Tests TTL cache pubkey→UUID resolution
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommentsService } from '../../../services/community/CommentsService';
import {
  UnauthorizedError,
  NotFoundError,
  ConflictError,
  ValidationError,
  AuthorizationError,
  ServiceError,
} from '../../../utils/errors';

// ============================================================================
// Table-aware Supabase mock (common-solutions.md #7)
// ============================================================================

/**
 * Supabase mock chain builder.
 *
 * The Supabase fluent API branches differently depending on whether the
 * operation is a SELECT (ending in .single() or .range()) or an UPDATE
 * (ending in .update().eq().eq().select('id')).
 *
 * `terminalSelect` is called when .select() is the LAST call in a chain
 * (i.e. after .update().eq().eq()) and must return a Promise, not `this`.
 * Set it via `commentsChain.terminalSelect = vi.fn().mockResolvedValue(...)`.
 */
function makeChain() {
  // Default no-op terminal select (overridden per test for update path)
  const terminalSelectFn = vi.fn().mockResolvedValue({ data: [], error: null });

  let afterUpdate = false;

  const chain: Record<string, unknown> = {
    // Fluent methods — always return chain (except terminal positions)
    select: vi.fn((..._args: unknown[]) => {
      // After update(), .select() is the terminal call
      if (afterUpdate) {
        afterUpdate = false;
        return terminalSelectFn(..._args);
      }
      return chain;
    }),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn((..._args: unknown[]) => {
      afterUpdate = true;
      return chain;
    }),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    // Expose so tests can configure the update terminal
    _terminalSelect: terminalSelectFn,
  };
  return chain;
}

// Per-table chain references so tests can configure them independently
let contentChain: ReturnType<typeof makeChain>;
let commentsChain: ReturnType<typeof makeChain>;
let usersChain: ReturnType<typeof makeChain>;

function makeMockDb() {
  contentChain = makeChain();
  commentsChain = makeChain();
  usersChain = makeChain();

  return {
    from: vi.fn((table: string) => {
      switch (table) {
        case 'content':
          return contentChain;
        case 'comments':
          return commentsChain;
        case 'users':
          return usersChain;
        default:
          return makeChain();
      }
    }),
  };
}

// ============================================================================
// Fixtures
// ============================================================================

const PUBKEY = 'abc123pubkey';
const USER_ID = 'user-uuid-1';
const CONTENT_ID = 'content-uuid-1';
const COMMENT_ID = 'comment-uuid-1';
const PARENT_ID = 'parent-uuid-1';

function makeCommentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: COMMENT_ID,
    content_id: CONTENT_ID,
    user_id: USER_ID,
    parent_comment_id: null,
    comment_text: 'Hello world',
    status: 'active',
    reply_count: 0,
    created_at: '2026-03-04T10:00:00Z',
    updated_at: '2026-03-04T10:00:00Z',
    users: {
      id: USER_ID,
      display_name: 'Alice',
      avatar_url: null,
      username: 'alice',
    },
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('CommentsService', () => {
  let db: ReturnType<typeof makeMockDb>;
  let logger: { error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };
  let service: CommentsService;

  beforeEach(() => {
    db = makeMockDb();
    logger = { error: vi.fn(), info: vi.fn() };
    service = new CommentsService(db as never, logger as never);
  });

  // ==========================================================================
  // listComments
  // ==========================================================================

  describe('listComments', () => {
    it('returns paginated comments for published content', async () => {
      const row = makeCommentRow();

      // content check
      contentChain.single = vi.fn().mockResolvedValue({
        data: { id: CONTENT_ID, status: 'published' },
        error: null,
      });

      // comments query (range returns data + count, not single)
      commentsChain.range = vi.fn().mockResolvedValue({
        data: [row],
        error: null,
        count: 1,
      });

      const result = await service.listComments(CONTENT_ID, null, { page: 1, limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe(COMMENT_ID);
      expect(result.items[0].author.displayName).toBe('Alice');
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.hasNext).toBe(false);
    });

    it('throws NotFoundError for missing content', async () => {
      contentChain.single = vi.fn().mockResolvedValue({ data: null, error: null });

      await expect(
        service.listComments(CONTENT_ID, null, { page: 1, limit: 20 })
      ).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError for non-published content', async () => {
      contentChain.single = vi.fn().mockResolvedValue({
        data: { id: CONTENT_ID, status: 'draft' },
        error: null,
      });

      await expect(
        service.listComments(CONTENT_ID, null, { page: 1, limit: 20 })
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ServiceError on DB query failure', async () => {
      contentChain.single = vi.fn().mockResolvedValue({
        data: { id: CONTENT_ID, status: 'published' },
        error: null,
      });
      commentsChain.range = vi.fn().mockResolvedValue({
        data: null,
        error: new Error('DB error'),
        count: null,
      });

      await expect(
        service.listComments(CONTENT_ID, null, { page: 1, limit: 20 })
      ).rejects.toThrow(ServiceError);
    });

    it('calculates hasNext correctly when more pages exist', async () => {
      const rows = Array.from({ length: 20 }, (_, i) =>
        makeCommentRow({ id: `comment-${i}` })
      );

      contentChain.single = vi.fn().mockResolvedValue({
        data: { id: CONTENT_ID, status: 'published' },
        error: null,
      });
      commentsChain.range = vi.fn().mockResolvedValue({
        data: rows,
        error: null,
        count: 45,
      });

      const result = await service.listComments(CONTENT_ID, null, { page: 1, limit: 20 });

      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.total).toBe(45);
    });

    it('returns empty items array with count 0 for content with no comments', async () => {
      contentChain.single = vi.fn().mockResolvedValue({
        data: { id: CONTENT_ID, status: 'published' },
        error: null,
      });
      commentsChain.range = vi.fn().mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      });

      const result = await service.listComments(CONTENT_ID, null, { page: 1, limit: 20 });

      expect(result.items).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.hasNext).toBe(false);
    });

    it('uses Anonymous fallback when display_name and username are null', async () => {
      const row = makeCommentRow({
        users: { id: USER_ID, display_name: null, avatar_url: null, username: null },
      });

      contentChain.single = vi.fn().mockResolvedValue({
        data: { id: CONTENT_ID, status: 'published' },
        error: null,
      });
      commentsChain.range = vi.fn().mockResolvedValue({
        data: [row],
        error: null,
        count: 1,
      });

      const result = await service.listComments(CONTENT_ID, null, { page: 1, limit: 20 });

      expect(result.items[0].author.displayName).toBe('Anonymous');
    });
  });

  // ==========================================================================
  // listReplies
  // ==========================================================================

  describe('listReplies', () => {
    beforeEach(() => {
      // Mock parent comment exists with published content (security audit P2-1 fix)
      commentsChain.single = vi.fn().mockResolvedValue({
        data: { id: COMMENT_ID, content_id: CONTENT_ID, content: { status: 'published' } },
        error: null,
      });
    });

    it('returns paginated replies for a comment', async () => {
      const reply = makeCommentRow({
        id: 'reply-uuid-1',
        parent_comment_id: COMMENT_ID,
      });
      commentsChain.range = vi.fn().mockResolvedValue({
        data: [reply],
        error: null,
        count: 1,
      });

      const result = await service.listReplies(COMMENT_ID, { page: 1, limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].parentCommentId).toBe(COMMENT_ID);
    });

    it('throws NotFoundError when parent comment does not exist', async () => {
      commentsChain.single = vi.fn().mockResolvedValue({ data: null, error: null });

      await expect(
        service.listReplies('nonexistent-id', { page: 1, limit: 20 })
      ).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError when parent comment belongs to non-published content', async () => {
      commentsChain.single = vi.fn().mockResolvedValue({
        data: { id: COMMENT_ID, content_id: CONTENT_ID, content: { status: 'draft' } },
        error: null,
      });

      await expect(
        service.listReplies(COMMENT_ID, { page: 1, limit: 20 })
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ServiceError on DB error', async () => {
      commentsChain.range = vi.fn().mockResolvedValue({
        data: null,
        error: new Error('Network failure'),
        count: null,
      });

      await expect(
        service.listReplies(COMMENT_ID, { page: 1, limit: 20 })
      ).rejects.toThrow(ServiceError);
    });
  });

  // ==========================================================================
  // createComment
  // ==========================================================================

  describe('createComment', () => {
    beforeEach(() => {
      // Mock pubkey→userId resolution
      usersChain.single = vi.fn().mockResolvedValue({
        data: { id: USER_ID },
        error: null,
      });
      // Mock content access check (security audit P3-2 fix)
      contentChain.single = vi.fn().mockResolvedValue({
        data: { id: CONTENT_ID, status: 'published' },
        error: null,
      });
    });

    it('creates a top-level comment successfully', async () => {
      const created = makeCommentRow();
      commentsChain.single = vi.fn().mockResolvedValue({
        data: created,
        error: null,
      });

      const result = await service.createComment(PUBKEY, CONTENT_ID, {
        commentText: 'Hello world',
      });

      expect(result.id).toBe(COMMENT_ID);
      expect(result.commentText).toBe('Hello world');
    });

    it('creates a reply to a top-level comment', async () => {
      // First single call: parent comment lookup
      // Second single call: insert result
      const parentRow = { parent_comment_id: null, status: 'active' };
      const createdRow = makeCommentRow({
        parent_comment_id: PARENT_ID,
        id: 'reply-uuid-1',
      });

      commentsChain.single = vi.fn()
        .mockResolvedValueOnce({ data: parentRow, error: null })
        .mockResolvedValueOnce({ data: createdRow, error: null });

      const result = await service.createComment(PUBKEY, CONTENT_ID, {
        commentText: 'Nice!',
        parentCommentId: PARENT_ID,
      });

      expect(result.parentCommentId).toBe(PARENT_ID);
    });

    it('throws UnauthorizedError when pubkey has no user profile', async () => {
      usersChain.single = vi.fn().mockResolvedValue({ data: null, error: new Error('Not found') });

      await expect(
        service.createComment('unknown-pubkey', CONTENT_ID, { commentText: 'Hi' })
      ).rejects.toThrow(UnauthorizedError);
    });

    it('throws NotFoundError when parent comment does not exist', async () => {
      commentsChain.single = vi.fn().mockResolvedValue({ data: null, error: null });

      await expect(
        service.createComment(PUBKEY, CONTENT_ID, {
          commentText: 'Reply',
          parentCommentId: 'nonexistent-id',
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ConflictError when parent comment is not active', async () => {
      commentsChain.single = vi.fn().mockResolvedValue({
        data: { parent_comment_id: null, status: 'deleted' },
        error: null,
      });

      await expect(
        service.createComment(PUBKEY, CONTENT_ID, {
          commentText: 'Reply',
          parentCommentId: PARENT_ID,
        })
      ).rejects.toThrow(ConflictError);
    });

    it('throws ValidationError when attempting to reply to a reply (two-level enforcement)', async () => {
      // Parent itself has a parent_comment_id set → it is already a reply
      commentsChain.single = vi.fn().mockResolvedValue({
        data: { parent_comment_id: 'grandparent-uuid', status: 'active' },
        error: null,
      });

      await expect(
        service.createComment(PUBKEY, CONTENT_ID, {
          commentText: 'Nested reply',
          parentCommentId: PARENT_ID,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('throws ServiceError when insert fails', async () => {
      // No parent → top-level comment, insert fails
      commentsChain.single = vi.fn().mockResolvedValue({
        data: null,
        error: new Error('Constraint violation'),
      });

      await expect(
        service.createComment(PUBKEY, CONTENT_ID, { commentText: 'Hi' })
      ).rejects.toThrow(ServiceError);
    });

    it('caches pubkey→UUID after first lookup (TTL cache)', async () => {
      const insertedRow = makeCommentRow();
      commentsChain.single = vi.fn().mockResolvedValue({
        data: insertedRow,
        error: null,
      });

      // First call — does a DB lookup
      await service.createComment(PUBKEY, CONTENT_ID, { commentText: 'First' });
      // Second call — should use cache (users.from not called again)
      commentsChain.single = vi.fn().mockResolvedValue({
        data: insertedRow,
        error: null,
      });
      await service.createComment(PUBKEY, CONTENT_ID, { commentText: 'Second' });

      // usersChain.single should only have been called once total
      expect(usersChain.single).toHaveBeenCalledTimes(1);
    });

    // -----------------------------------------------------------------------
    // XSS sanitization
    // -----------------------------------------------------------------------

    it('strips NUL (\\x00) and other control characters from comment text', async () => {
      const dangerousText = 'Hello\x00\x01\x08\x0B\x0C\x0E\x1F\x7Fworld';
      const insertedRow = makeCommentRow({ comment_text: 'Helloworld' });
      commentsChain.single = vi.fn().mockResolvedValue({
        data: insertedRow,
        error: null,
      });

      await service.createComment(PUBKEY, CONTENT_ID, { commentText: dangerousText });

      // Verify insert was called with sanitized text (no control chars)
      const insertCall = commentsChain.insert.mock.calls[0][0] as { comment_text: string };
      expect(insertCall.comment_text).not.toMatch(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/);
    });

    it('preserves intentional whitespace (\\t, \\n, \\r) in comment text', async () => {
      const text = 'Line1\nLine2\tTabbed\r\nWindows';
      const insertedRow = makeCommentRow({ comment_text: text });
      commentsChain.single = vi.fn().mockResolvedValue({
        data: insertedRow,
        error: null,
      });

      await service.createComment(PUBKEY, CONTENT_ID, { commentText: text });

      const insertCall = commentsChain.insert.mock.calls[0][0] as { comment_text: string };
      expect(insertCall.comment_text).toContain('\n');
      expect(insertCall.comment_text).toContain('\t');
    });

    it('truncates comment text longer than 2000 chars', async () => {
      const longText = 'a'.repeat(2500);
      const insertedRow = makeCommentRow({ comment_text: 'a'.repeat(2000) });
      commentsChain.single = vi.fn().mockResolvedValue({
        data: insertedRow,
        error: null,
      });

      await service.createComment(PUBKEY, CONTENT_ID, { commentText: longText });

      const insertCall = commentsChain.insert.mock.calls[0][0] as { comment_text: string };
      expect(insertCall.comment_text.length).toBeLessThanOrEqual(2000);
    });

    it('strips embedded null bytes from XSS payload', async () => {
      // Technique used to bypass some WAFs
      const xssPayload = '<script\x00>alert(1)</script\x00>';
      const insertedRow = makeCommentRow({ comment_text: '<script>alert(1)</script>' });
      commentsChain.single = vi.fn().mockResolvedValue({
        data: insertedRow,
        error: null,
      });

      await service.createComment(PUBKEY, CONTENT_ID, { commentText: xssPayload });

      const insertCall = commentsChain.insert.mock.calls[0][0] as { comment_text: string };
      expect(insertCall.comment_text).not.toMatch(/\x00/);
    });
  });

  // ==========================================================================
  // deleteComment
  // ==========================================================================

  describe('deleteComment', () => {
    beforeEach(() => {
      usersChain.single = vi.fn().mockResolvedValue({
        data: { id: USER_ID },
        error: null,
      });
    });

    it('soft-deletes comment as owner (status → deleted)', async () => {
      const CREATOR_ID = 'other-creator-uuid';
      const commentWithContent = {
        id: COMMENT_ID,
        user_id: USER_ID,
        content_id: CONTENT_ID,
        status: 'active',
        content: { creator_id: CREATOR_ID },
      };

      commentsChain.single = vi.fn().mockResolvedValue({
        data: commentWithContent,
        error: null,
      });
      // Terminal select after update()
      (commentsChain._terminalSelect as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [{ id: COMMENT_ID }],
        error: null,
      });

      await expect(
        service.deleteComment(PUBKEY, COMMENT_ID)
      ).resolves.toBeUndefined();
    });

    it('moderates comment as content creator (status → moderated)', async () => {
      const CREATOR_PUBKEY = 'creator-pubkey';
      const CREATOR_UUID = 'creator-uuid';

      const db2 = makeMockDb();
      const u2 = db2.from('users') as ReturnType<typeof makeChain>;
      u2.single = vi.fn().mockResolvedValue({ data: { id: CREATOR_UUID }, error: null });

      const c2 = db2.from('comments') as ReturnType<typeof makeChain>;
      c2.single = vi.fn().mockResolvedValue({
        data: {
          id: COMMENT_ID,
          user_id: 'original-commenter-uuid',
          content_id: CONTENT_ID,
          status: 'active',
          content: { creator_id: CREATOR_UUID },
        },
        error: null,
      });
      (c2._terminalSelect as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [{ id: COMMENT_ID }],
        error: null,
      });

      const svc2 = new CommentsService(db2 as never, logger as never);
      await expect(svc2.deleteComment(CREATOR_PUBKEY, COMMENT_ID)).resolves.toBeUndefined();
    });

    it('throws NotFoundError when comment does not exist', async () => {
      commentsChain.single = vi.fn().mockResolvedValue({ data: null, error: null });

      await expect(
        service.deleteComment(PUBKEY, 'nonexistent-id')
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ConflictError when comment is already deleted (status guard)', async () => {
      commentsChain.single = vi.fn().mockResolvedValue({
        data: {
          id: COMMENT_ID,
          user_id: USER_ID,
          content_id: CONTENT_ID,
          status: 'deleted',
          content: { creator_id: 'other-uuid' },
        },
        error: null,
      });

      await expect(
        service.deleteComment(PUBKEY, COMMENT_ID)
      ).rejects.toThrow(ConflictError);
    });

    it('throws ConflictError when comment is moderated (status guard)', async () => {
      commentsChain.single = vi.fn().mockResolvedValue({
        data: {
          id: COMMENT_ID,
          user_id: USER_ID,
          content_id: CONTENT_ID,
          status: 'moderated',
          content: { creator_id: 'other-uuid' },
        },
        error: null,
      });

      await expect(
        service.deleteComment(PUBKEY, COMMENT_ID)
      ).rejects.toThrow(ConflictError);
    });

    it('throws AuthorizationError (403 not 400) for non-owner, non-creator', async () => {
      const STRANGER_UUID = 'stranger-uuid';
      usersChain.single = vi.fn().mockResolvedValue({
        data: { id: STRANGER_UUID },
        error: null,
      });

      commentsChain.single = vi.fn().mockResolvedValue({
        data: {
          id: COMMENT_ID,
          user_id: 'original-owner',
          content_id: CONTENT_ID,
          status: 'active',
          content: { creator_id: 'original-creator' },
        },
        error: null,
      });

      const err = await service.deleteComment(PUBKEY, COMMENT_ID).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(AuthorizationError);
      // AuthorizationError must be 403 — not 400
      expect((err as AuthorizationError).statusCode).toBe(403);
    });

    it('throws ConflictError when atomic UPDATE finds no matching active row', async () => {
      commentsChain.single = vi.fn().mockResolvedValue({
        data: {
          id: COMMENT_ID,
          user_id: USER_ID,
          content_id: CONTENT_ID,
          status: 'active',
          content: { creator_id: 'other-uuid' },
        },
        error: null,
      });
      // Update returns empty array → row was already modified by concurrent request
      (commentsChain._terminalSelect as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [],
        error: null,
      });

      await expect(
        service.deleteComment(PUBKEY, COMMENT_ID)
      ).rejects.toThrow(ConflictError);
    });

    it('throws ServiceError when update DB call fails', async () => {
      commentsChain.single = vi.fn().mockResolvedValue({
        data: {
          id: COMMENT_ID,
          user_id: USER_ID,
          content_id: CONTENT_ID,
          status: 'active',
          content: { creator_id: 'other-uuid' },
        },
        error: null,
      });
      (commentsChain._terminalSelect as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: new Error('DB write error'),
      });

      await expect(
        service.deleteComment(PUBKEY, COMMENT_ID)
      ).rejects.toThrow(ServiceError);
    });
  });
});
