import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { shieldApi } from '../services/shieldApi';
import type { AlertStatus } from '../types';
import { shieldKeys } from './shieldKeys';

export function useAlerts(status: AlertStatus = 'new', page = 1, limit = 20) {
  const hasInitialData = useRef(false);
  const prevStatus = useRef(status);

  // #617: Reset keepPreviousData gate when filter changes to prevent wrong-status flash
  if (prevStatus.current !== status) {
    hasInitialData.current = false;
    prevStatus.current = status;
  }

  const query = useQuery({
    queryKey: shieldKeys.alertList(status, page),
    queryFn: () => shieldApi.getAlerts(status, page, limit),
    staleTime: 1 * 60 * 1000, // 1 minute — alerts are time-sensitive
    placeholderData: hasInitialData.current ? keepPreviousData : undefined,
  });

  if (query.data) {
    hasInitialData.current = true;
  }

  return query;
}

export function useAlertDetail(alertId: string) {
  return useQuery({
    queryKey: shieldKeys.alertDetail(alertId),
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
      queryClient.invalidateQueries({ queryKey: shieldKeys.alerts() });
    },
  });
}
