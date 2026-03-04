/**
 * Comments feature barrel export.
 * Slice 6: Comments CRUD with Threading and Moderation
 */

// Components
export { CommentList, CommentForm, CommentItem } from './components';

// Hooks
export {
  useComments,
  useReplies,
  useCreateComment,
  useDeleteComment,
} from './hooks/useComments';

// API service
export { commentsApi } from './services/commentsApi';

// Types (re-exported from @shared/types/comments for convenience)
export type {
  Comment,
  CommentAuthor,
  CommentStatus,
  CommentWithAuthor,
  CommentsPaginatedResponse,
  CreateCommentBody,
} from './types';
