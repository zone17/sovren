/**
 * Comments API Service
 * Slice 6: Comments CRUD with Threading and Moderation
 *
 * Domain-scoped API service — does NOT extend the shared apiClient.
 * Follows the wellnessApi.ts pattern.
 */

import apiClient from '@/services/api/apiClient';
import type {
  CommentWithAuthor,
  CommentsPaginatedResponse,
  CreateCommentBody,
} from '@shared/types/comments';

const BASE = '/api/v2/comments';

export const commentsApi = {
  /**
   * List top-level comments for a piece of content.
   * Anonymous users can view comments on public content.
   */
  listComments(
    contentId: string,
    params?: { page?: number; limit?: number }
  ): Promise<CommentsPaginatedResponse> {
    return apiClient.get(`${BASE}/${contentId}`, {
      page: params?.page,
      limit: params?.limit,
    });
  },

  /**
   * List replies for a top-level comment.
   * Lazy-loaded when the user expands a comment thread.
   */
  listReplies(
    commentId: string,
    params?: { page?: number; limit?: number }
  ): Promise<CommentsPaginatedResponse> {
    return apiClient.get(`${BASE}/${commentId}/replies`, {
      page: params?.page,
      limit: params?.limit,
    });
  },

  /**
   * Create a new comment or reply on a piece of content.
   * Requires authentication.
   */
  createComment(
    contentId: string,
    payload: CreateCommentBody
  ): Promise<CommentWithAuthor> {
    return apiClient.post(`${BASE}/${contentId}`, payload);
  },

  /**
   * Soft-delete a comment.
   * Owner sets status to 'deleted'; content creator sets status to 'moderated'.
   * Requires authentication.
   */
  deleteComment(commentId: string): Promise<void> {
    return apiClient.delete(`${BASE}/${commentId}`);
  },
};
