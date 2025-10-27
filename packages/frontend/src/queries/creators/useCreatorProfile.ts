import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { CreatorProfile } from '@/types/creator';
import { creatorsKeys } from './useCreators';

/**
 * Fetch individual creator profile
 */
const fetchCreatorProfile = async (creatorId: string): Promise<CreatorProfile> => {
  const response = await fetch(`/api/creators/${creatorId}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Creator not found');
    }
    throw new Error(`Failed to fetch creator profile: ${response.statusText}`);
  }

  return response.json();
};

/**
 * Hook to fetch individual creator profile
 */
export const useCreatorProfile = (
  creatorId: string,
  options?: Omit<UseQueryOptions<CreatorProfile, Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery<CreatorProfile, Error>({
    queryKey: creatorsKeys.detail(creatorId),
    queryFn: () => fetchCreatorProfile(creatorId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!creatorId,
    ...options,
  });
};