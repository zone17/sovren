/**
 * Comments feature types — re-exported from @shared/types/comments.
 * Import from here within the comments feature module.
 * External consumers should import from '@shared/types/comments' directly
 * or from the feature barrel 'features/comments'.
 */

export type {
  Comment,
  CommentAuthor,
  CommentStatus,
  CommentWithAuthor,
  CommentsPaginatedResponse,
  CreateCommentBody,
} from '@shared/types/comments';
