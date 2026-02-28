import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { CreatorsResponse, CreatorFilters } from '@/types/creator';

/**
 * API endpoint for fetching creators
 */
const fetchCreators = async (filters?: CreatorFilters): Promise<CreatorsResponse> => {
  const params = new URLSearchParams();

  if (filters?.page) params.append('page', filters.page.toString());
  if (filters?.limit) params.append('limit', filters.limit.toString());
  if (filters?.category) params.append('category', filters.category);
  if (filters?.sortBy) params.append('sortBy', filters.sortBy);
  if (filters?.search) params.append('search', filters.search);

  const response = await fetch(`/api/creators?${params.toString()}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch creators: ${response.statusText}`);
  }

  return response.json();
};

/**
 * Query key factory for creators
 */
export const creatorsKeys = {
  all: ['creators'] as const,
  lists: () => [...creatorsKeys.all, 'list'] as const,
  list: (filters?: CreatorFilters) => [...creatorsKeys.lists(), { filters }] as const,
  details: () => [...creatorsKeys.all, 'detail'] as const,
  detail: (id: string) => [...creatorsKeys.details(), id] as const,
};

/**
 * Hook to fetch paginated creators list with filtering
 */
export const useCreators = (
  filters?: CreatorFilters,
  options?: Omit<UseQueryOptions<CreatorsResponse, Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery<CreatorsResponse, Error>({
    queryKey: creatorsKeys.list(filters),
    queryFn: () => fetchCreators(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    ...options,
  });
};