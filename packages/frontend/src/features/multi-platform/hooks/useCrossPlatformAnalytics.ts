import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../services/analyticsApi';

export function useCrossPlatformOverview() {
  return useQuery({
    queryKey: ['analytics', 'cross-platform', 'overview'],
    queryFn: () => analyticsApi.getOverview(),
    select: (res) => res.data,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePlatformComparison(contentId: string) {
  return useQuery({
    queryKey: ['analytics', 'cross-platform', 'comparison', contentId],
    queryFn: () => analyticsApi.getComparison(contentId),
    select: (res) => res.data,
    enabled: !!contentId,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePlatformROI() {
  return useQuery({
    queryKey: ['analytics', 'cross-platform', 'roi'],
    queryFn: () => analyticsApi.getROI(),
    select: (res) => res.data,
    staleTime: 5 * 60 * 1000,
  });
}
