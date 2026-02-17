import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { shieldApi } from '../services/shieldApi';
import type { AlertStatus } from '../types';

export function useAlerts(status: AlertStatus = 'new', page = 1, limit = 20) {
  return useQuery({
    queryKey: ['shield', 'alerts', status, page],
    queryFn: () => shieldApi.getAlerts(status, page, limit),
    staleTime: 1 * 60 * 1000, // 1 minute — alerts are time-sensitive
  });
}

export function useAlertDetail(alertId: string) {
  return useQuery({
    queryKey: ['shield', 'alerts', 'detail', alertId],
    queryFn: () => shieldApi.getAlertDetail(alertId),
    select: (res) => res.data,
    staleTime: 1 * 60 * 1000,
    enabled: !!alertId,
  });
}

export function useUpdateAlertStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ alertId, status }: { alertId: string; status: AlertStatus }) =>
      shieldApi.updateAlertStatus(alertId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shield', 'alerts'] });
    },
  });
}
