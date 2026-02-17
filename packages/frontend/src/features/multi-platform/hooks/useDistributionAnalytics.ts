import { useQuery } from '@tanstack/react-query';
import { distributionApi } from '../services/distributionApi';

export function useAnalyticsOverview() {
  return useQuery({
    queryKey: ['distribution', 'analytics', 'overview'],
    queryFn: () => distributionApi.getAnalyticsOverview(),
    select: (res) => res.data,
    staleTime: 5 * 60 * 1000,
  });
}

export function useContentComparison(contentId: string) {
  return useQuery({
    queryKey: ['distribution', 'analytics', 'comparison', contentId],
    queryFn: () => distributionApi.getContentComparison(contentId),
    select: (res) => res.data,
    enabled: !!contentId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useROI() {
  return useQuery({
    queryKey: ['distribution', 'analytics', 'roi'],
    queryFn: () => distributionApi.getROI(),
    select: (res) => res.data,
    staleTime: 5 * 60 * 1000,
  });
}
