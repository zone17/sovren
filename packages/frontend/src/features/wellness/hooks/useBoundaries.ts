import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { wellnessApi } from '../services/wellnessApi';
import type { BoundaryUpdatePayload } from '../types';

export function useBoundaries() {
  return useQuery({
    queryKey: ['wellness', 'boundaries'],
    queryFn: () => wellnessApi.getBoundaries(),
    select: (res) => res.data,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateBoundaries() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BoundaryUpdatePayload) => wellnessApi.updateBoundaries(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wellness', 'boundaries'] });
    },
  });
}
