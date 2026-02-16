import { useQuery } from '@tanstack/react-query';
import { wellnessApi } from '../services/wellnessApi';
import type { HeatmapPeriod, PatternPeriod } from '../types';

export function useWellnessPatterns(period: PatternPeriod = '7d') {
  return useQuery({
    queryKey: ['wellness', 'patterns', period],
    queryFn: () => wellnessApi.getPatterns(period),
    select: (res) => res.data,
    staleTime: 5 * 60 * 1000,
  });
}

export function useWellnessHeatmap(period: HeatmapPeriod = '7d') {
  return useQuery({
    queryKey: ['wellness', 'patterns', 'heatmap', period],
    queryFn: () => wellnessApi.getHeatmap(period),
    select: (res) => res.data,
    staleTime: 5 * 60 * 1000,
  });
}
