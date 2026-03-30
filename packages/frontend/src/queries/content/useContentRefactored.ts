/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/**
 * Refactored Content Query Hook
 * Server data in React Query, UI state in Redux
 * Following Elite State Management Standards
 */

import { useInfiniteQuery, UseInfiniteQueryOptions } from '@tanstack/react-query';
import { useAppSelector } from '@/store';
import {
  selectCurrentPage,
  selectPageSize,
  selectSorting,
  selectFilters,
} from '@/store/slices/paginationSlice';
import { ContentResponse } from '@/types/content-query';

/**
 * Fetch content from server
 * Only server-related parameters, no UI state
 */
const fetchContent = async ({
  page,
  limit,
  sortBy,
  sortDirection,
  filters,
}: {
  page: number;
  limit: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  filters?: Record<string, unknown>;
}): Promise<ContentResponse> => {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('limit', limit.toString());

  if (sortBy) {
    params.append('sortBy', sortBy);
    params.append('sortDirection', sortDirection || 'desc');
  }

  // Add filters
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        if (Array.isArray(value)) {
          params.append(key, value.join(','));
        } else {
          params.append(key, value.toString());
        }
      }
    });
  }

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
 * IMPORTANT: No UI state in keys, only server-relevant params
 */
export const contentKeys = {
  all: ['content'] as const,
  // No pagination/filters in keys - those are UI state
  list: () => [...contentKeys.all, 'list'] as const,
  details: () => [...contentKeys.all, 'detail'] as const,
  detail: (id: string) => [...contentKeys.details(), id] as const,
};

/**
 * Hook to fetch content using Redux for UI state
 * This is the refactored version that properly separates concerns
 */
export const useContentRefactored = (
  section: string = 'content',
  options?: Omit<
    UseInfiniteQueryOptions<ContentResponse, Error>,
    'queryKey' | 'queryFn' | 'getNextPageParam'
  >
) => {
  // Get UI state from Redux
  const currentPage = useAppSelector(selectCurrentPage(section));
  const pageSize = useAppSelector(selectPageSize(section));
  const sorting = useAppSelector(selectSorting(section));
  const filters = useAppSelector(selectFilters(section));

  return useInfiniteQuery<ContentResponse, Error>({
    // Clean query key without UI state
    queryKey: contentKeys.list(),
    queryFn: ({ pageParam }) =>
      fetchContent({
        page: (pageParam as number) || currentPage,
        limit: pageSize,
        sortBy: sorting?.field,
        sortDirection: sorting?.direction,
        filters,
      }),
    getNextPageParam: lastPage => {
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
    initialPageParam: currentPage,
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
};

/**
 * Hook for simple paginated content (non-infinite scroll)
 */
export const useContentPaginated = (
  section: string = 'content',
  options?: Omit<UseInfiniteQueryOptions<ContentResponse, Error>, 'queryKey' | 'queryFn'>
) => {
  // Get UI state from Redux
  const currentPage = useAppSelector(selectCurrentPage(section));
  const pageSize = useAppSelector(selectPageSize(section));
  const sorting = useAppSelector(selectSorting(section));
  const filters = useAppSelector(selectFilters(section));

  return useInfiniteQuery<ContentResponse, Error>({
    // Clean query key without UI state
    queryKey: contentKeys.list(),
    queryFn: () =>
      fetchContent({
        page: currentPage,
        limit: pageSize,
        sortBy: sorting?.field,
        sortDirection: sorting?.direction,
        filters,
      }),
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    ...options,
  });
};
