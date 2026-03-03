import { useQuery } from '@tanstack/react-query';
import { wellnessApi } from '../services/wellnessApi';

export function useGetBenchmarks(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['wellness', 'benchmarks'],
    queryFn: () => wellnessApi.getBenchmarks(),
    select: (res) => res.data,
    staleTime: 30 * 60 * 1000, // 30 min — benchmarks are community aggregates, infrequently updated
    enabled: options?.enabled ?? true,
  });
}
