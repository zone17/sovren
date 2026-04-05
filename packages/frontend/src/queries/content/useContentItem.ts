import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { ContentItemDetail } from '@/types/content-query';
import { contentKeys } from './useContent';

/**
 * Fetch individual content item
 */
const fetchContentItem = async (contentId: string): Promise<ContentItemDetail> => {
  const response = await fetch(`/api/content/${contentId}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Content not found');
    }
    throw new Error(`Failed to fetch content: ${response.statusText}`);
  }

  return response.json();
};

/**
 * Hook to fetch individual content item
 */
export const useContentItem = (
  contentId: string,
  options?: Omit<UseQueryOptions<ContentItemDetail, Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery<ContentItemDetail, Error>({
    queryKey: contentKeys.detail(contentId),
    queryFn: () => fetchContentItem(contentId),
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    enabled: !!contentId,
    ...options,
  });
};
