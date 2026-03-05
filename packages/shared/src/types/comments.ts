/**
 * Comments Shared Types
 * Slice 6: Comments CRUD with Threading and Moderation
 * Squad B, Sprint 2
 */

export type CommentStatus = 'active' | 'deleted' | 'moderated';

export interface Comment {
  id: string;
  contentId: string;
  userId: string;
  parentCommentId: string | null;
  commentText: string;
  status: CommentStatus;
  replyCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CommentAuthor {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  username: string | null;
}

export interface CommentWithAuthor extends Comment {
  author: CommentAuthor;
}

// NOTE: contentId comes from URL param /:contentId, not the request body
export interface CreateCommentBody {
  parentCommentId?: string;
  commentText: string;
}

export interface CommentsPaginatedResponse {
  items: CommentWithAuthor[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
  };
}
