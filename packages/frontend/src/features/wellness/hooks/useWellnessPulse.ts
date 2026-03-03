import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { wellnessApi } from '../services/wellnessApi';
import type { PulsePeriod, PulseSubmission } from '../types';

export function useWellnessPulseHistory(
  period: PulsePeriod = '90d',
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['wellness', 'pulse', period],
    queryFn: () => wellnessApi.getPulseHistory(period),
    select: (res) => res.data,
    staleTime: 5 * 60 * 1000,
    enabled: options?.enabled ?? true,
  });
}

export function useSubmitPulse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: PulseSubmission) => wellnessApi.submitPulse(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wellness', 'pulse'] });
      queryClient.invalidateQueries({ queryKey: ['wellness', 'risk-score'] });
    },
  });
}
