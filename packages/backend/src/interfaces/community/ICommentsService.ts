/**
 * ICommentsService — Interface for the Comments domain
 * Slice 6: Comments CRUD with Threading and Moderation
 * Squad B, Sprint 2
 */

import type { CommentWithAuthor, CommentsPaginatedResponse } from '@shared/types/comments';

export interface ICommentsService {
  /**
   * List top-level comments for a piece of content.
   * @param contentId - UUID of the content
   * @param pagination - Page/limit options
   */
  listComments(
    contentId: string,
    pagination: { page: number; limit: number }
  ): Promise<CommentsPaginatedResponse>;

  /**
   * List replies to a specific top-level comment.
   * @param commentId - UUID of the parent comment
   * @param pagination - Page/limit options
   */
  listReplies(
    commentId: string,
    pagination: { page: number; limit: number }
  ): Promise<CommentsPaginatedResponse>;

  /**
   * Create a new comment (top-level or reply).
   * @param callerPubkey - NOSTR pubkey of the authenticated user
   * @param contentId - UUID of the content being commented on
   * @param payload - Comment body (text + optional parentCommentId)
   */
  createComment(
    callerPubkey: string,
    contentId: string,
    payload: { parentCommentId?: string; commentText: string }
  ): Promise<CommentWithAuthor>;

  /**
   * Soft-delete a comment (own) or moderate it (content creator).
   * Sets status to 'deleted' for own comments, 'moderated' for creator moderation.
   * @param callerPubkey - NOSTR pubkey of the authenticated user
   * @param commentId - UUID of the comment to delete/moderate
   */
  deleteComment(callerPubkey: string, commentId: string): Promise<void>;
}
