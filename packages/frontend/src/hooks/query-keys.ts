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
};

export const followKeys = {
  all: ['follow'] as const,
  isFollowing: (userId: string) => [...followKeys.all, 'is-following', userId] as const,
  followers: (userId: string, page?: number) =>
    [...followKeys.all, 'followers', userId, page] as const,
  following: (userId: string, page?: number) =>
    [...followKeys.all, 'following', userId, page] as const,
  counts: (userId: string) => [...followKeys.all, 'counts', userId] as const,
};

export const discoveryKeys = {
  all: ['discovery'] as const,
  creators: (filters: Record<string, unknown>) =>
    [...discoveryKeys.all, 'creators', filters] as const,
};

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (page?: number) => [...notificationKeys.all, 'list', page] as const,
};

export const circleKeys = {
  all: ['creator-network', 'circles'] as const,
  lists: () => [...circleKeys.all, 'list'] as const,
  suggested: () => [...circleKeys.all, 'suggested'] as const,
  details: () => [...circleKeys.all, 'detail'] as const,
  detail: (id: string) => [...circleKeys.details(), id] as const,
  posts: (circleId: string) => [...circleKeys.detail(circleId), 'posts'] as const,
};

export const mentorshipKeys = {
  all: ['creator-network', 'mentors'] as const,
  list: (params?: Record<string, string>) => [...mentorshipKeys.all, 'list', params] as const,
  myMentorships: () => [...mentorshipKeys.all, 'my-mentorships'] as const,
};
