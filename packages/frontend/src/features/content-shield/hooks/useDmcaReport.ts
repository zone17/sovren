import { useMutation, useQueryClient } from '@tanstack/react-query';
import { shieldApi } from '../services/shieldApi';
import type { ReportFormat } from '../types';
import { shieldKeys } from './shieldKeys';

export function useDmcaReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ alertId, format = 'json' }: { alertId: string; format?: ReportFormat }) =>
      shieldApi.generateDmcaReport(alertId, format),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: shieldKeys.alertDetail(variables.alertId),
      });
    },
  });
}
