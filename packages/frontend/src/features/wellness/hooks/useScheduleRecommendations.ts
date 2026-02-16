import { useQuery } from '@tanstack/react-query';
import { wellnessApi } from '../services/wellnessApi';

export function useScheduleRecommendations() {
  return useQuery({
    queryKey: ['wellness', 'schedule'],
    queryFn: () => wellnessApi.getScheduleRecommendations(),
    select: (res) => res.data,
    staleTime: 5 * 60 * 1000,
  });
}
