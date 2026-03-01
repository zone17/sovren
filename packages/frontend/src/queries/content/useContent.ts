// @ts-nocheck
import { useInfiniteQuery, UseInfiniteQueryOptions } from '@tanstack/react-query';
import { ContentFilters, ContentResponse } from '@/types/content-query';

/**
 * Fetch content with pagination
 */
const fetchContent = async ({
  pageParam = 1,
  filters,
}: {
  pageParam?: number;
  filters?: ContentFilters;
}): Promise<ContentResponse> => {
  const params = new URLSearchParams();
  params.append('page', pageParam.toString());

  if (filters?.limit) params.append('limit', filters.limit.toString());
  if (filters?.creatorId) params.append('creatorId', filters.creatorId);
  if (filters?.type) params.append('type', filters.type);
  if (filters?.category) params.append('category', filters.category);
  if (filters?.tags?.length) params.append('tags', filters.tags.join(','));
  if (filters?.search) params.append('search', filters.search);
  if (filters?.sortBy) params.append('sortBy', filters.sortBy);
  if (filters?.isPremium !== undefined) params.append('isPremium', filters.isPremium.toString());

  const response = await fetch(`/api/content?${params.toString()}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch content: ${response.statusText}`);
  }

  return response.json();
};

/**
 * Query key factory for content
 */
export const contentKeys = {
  all: ['content'] as const,
  lists: () => [...contentKeys.all, 'list'] as const,
  list: (filters?: ContentFilters) => [...contentKeys.lists(), { filters }] as const,
  details: () => [...contentKeys.all, 'detail'] as const,
  detail: (id: string) => [...contentKeys.details(), id] as const,
};

/**
 * Hook to fetch content with infinite scrolling
 */
export const useContent = (
  filters?: ContentFilters,
  options?: Omit<
    UseInfiniteQueryOptions<ContentResponse, Error>,
    'queryKey' | 'queryFn' | 'getNextPageParam'
  >
) => {
  return useInfiniteQuery<ContentResponse, Error>({
    queryKey: contentKeys.list(filters),
    queryFn: ({ pageParam }) => fetchContent({ pageParam: pageParam as number, filters }),
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
    initialPageParam: 1,
    staleTime: 1 * 60 * 1000, // 1 minute (content updates more frequently)
    gcTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
};
