import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { wellnessApi } from '../services/wellnessApi';
import type { Sensitivity } from '../types';

export function useBurnoutScore() {
  return useQuery({
    queryKey: ['wellness', 'risk-score'],
    queryFn: () => wellnessApi.getRiskScore(),
    select: (res) => res.data,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateSensitivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sensitivity: Sensitivity) => wellnessApi.updateSensitivity(sensitivity),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wellness', 'risk-score'] });
    },
  });
}
