import { useQuery } from '@tanstack/react-query';
import { wellnessApi } from '../services/wellnessApi';

export function useGetResourceLibrary() {
  return useQuery({
    queryKey: ['wellness', 'resources'],
    queryFn: () => wellnessApi.getResourceLibrary(),
    select: (res) => res.data,
    staleTime: 60 * 60 * 1000, // 1 hour — static resources change infrequently
  });
}
