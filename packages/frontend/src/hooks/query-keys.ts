/**
 * Centralized React Query key factories.
 * Use these factories in hooks to ensure cache invalidation targets the correct keys.
 *
 * Pattern: hierarchical keys so invalidating a parent key also invalidates all children.
 * e.g. invalidating commentKeys.byContent(id) clears both list and count for that content.
 */

export const commentKeys = {
  all: ['comments'] as const,
  byContent: (contentId: string) => [...commentKeys.all, 'content', contentId] as const,
  list: (contentId: string, filters?: Record<string, unknown>) =>
    [...commentKeys.byContent(contentId), 'list', filters] as const,
  replies: (commentId: string) => [...commentKeys.all, 'replies', commentId] as const,
  count: (contentId: string) => [...commentKeys.byContent(contentId), 'count'] as const,
};
